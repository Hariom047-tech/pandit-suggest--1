#!/usr/bin/env node
/**
 * Creates — or repairs — a super-admin on a database that ALREADY has users.
 *
 * scripts/bootstrap-superadmin.js deliberately refuses to run once any account
 * exists: it provisions the very first identity on a clean database and nothing
 * else. That is the right shape for a cutover and the wrong shape for "the
 * existing super-admin can no longer get in", which is what this script is for.
 *
 *   node scripts/create-superadmin.js --check <email>            # diagnose only
 *   node scripts/create-superadmin.js --verify <email>           # replay the login
 *   node scripts/create-superadmin.js --email <email> --name "Full Name"
 *   node scripts/create-superadmin.js --email <email> --reset    # existing account
 *
 * The password is read from the TTY with echo disabled, so it never reaches
 * argv, the environment, shell history, or this process's output — the same
 * property bootstrap-superadmin.js holds, and the reason neither script takes
 * ADMIN_PASSWORD from the environment the way the older create-admin.js does.
 *
 * Both paths leave totp_enabled = FALSE with no stored secret, so the first
 * login forces a fresh MFA enrolment (controllers/admin/auth.controller.js
 * branches on !user.totp_enabled and hands back a QR secret at step 1). That
 * is the point: a lost authenticator is the usual reason an admin account
 * stops working, and reusing the old secret would not fix it.
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const MIN_PASSWORD_LENGTH = 16;
const ALLOWED_ROLES = ['super_admin', 'admin'];

function fail(msg) {
  console.error('\n[create-superadmin] ' + msg + '\n');
  process.exit(1);
}

/** Minimal --flag value parser. Unknown flags are an error, not a silent no-op. */
function parseArgs(argv) {
  const out = { role: 'super_admin' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const take = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) fail(a + ' needs a value.');
      i += 1;
      return v;
    };
    if (a === '--email') out.email = take();
    else if (a === '--name') out.name = take();
    else if (a === '--role') out.role = take();
    else if (a === '--check') out.check = take();
    else if (a === '--verify') out.verify = take();
    else if (a === '--reset') out.reset = true;
    else if (a === '--password-from-stdin') out.pwStdin = true;
    else fail('unknown argument: ' + a);
  }
  return out;
}

/** Reads one line from the TTY with echo off — never rendered, never in history. */
function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('stdin is not a TTY. Run this interactively (docker exec -it), '
        + 'or pass --password-from-stdin to supply the password from a secret store.'));
      return;
    }
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') {                    // Ctrl-C
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(buf);
          return;
        }
        if (ch === '\u007f' || ch === '\b') buf = buf.slice(0, -1); // backspace
        else buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}

/** Reads all of stdin. Used only with the explicit --password-from-stdin flag. */
function readAllStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

/**
 * RDS requires TLS with real CA verification; rds.force_ssl = 1 rejects a
 * plaintext connection outright. Mirrors config/db.js — rejectUnauthorized:
 * false is not an acceptable substitute here either.
 */
function sslConfig(url) {
  if (!/rds\.amazonaws\.com/.test(url) && process.env.PGSSLMODE !== 'verify-full') return false;
  const caPath = process.env.RDS_CA_BUNDLE
    || path.join(__dirname, '..', '..', 'certs', 'rds-global-bundle.pem');
  if (!fs.existsSync(caPath)) {
    fail('RDS connection requires the CA bundle at ' + caPath + '.\n'
      + '  Download: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem');
  }
  return { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') };
}

/**
 * The app role is subject to RLS on `users`. INSERT passes (users_insert_self
 * is WITH CHECK true) but RETURNING needs a SELECT policy match on the new
 * row, and UPDATE needs one on the existing row — users_select_self and
 * users_update_self both key off current_app_user_id(). So the row's own id
 * goes into app.current_user_id first. Harmless when connected as the migrator
 * or owner, where RLS does not apply at all.
 */
async function setUserContext(client, userId) {
  await client.query("SELECT set_config('app.current_user_id', $1, false)", [userId]);
}

function printUser(u, indent = '    ') {
  console.log(indent + 'id             ' + u.id);
  console.log(indent + 'email          ' + u.email);
  console.log(indent + 'name           ' + u.full_name);
  console.log(indent + 'role           ' + u.role);
  console.log(indent + 'status         ' + u.status);
  console.log(indent + 'email_verified ' + u.email_verified);
  console.log(indent + 'totp_enabled   ' + u.totp_enabled);
}

/** Explains, in the login flow's own terms, why an account would be refused. */
function diagnose(u) {
  const notes = [];
  if (!ALLOWED_ROLES.includes(u.role)) {
    notes.push('role is "' + u.role + '" — the admin login only accepts '
      + ALLOWED_ROLES.join(' / ') + ', so this account gets the generic 401.');
  }
  if (u.status !== 'active') {
    notes.push('status is "' + u.status + '" — login returns 403 "Account is ' + u.status + '".');
  }
  if (u.totp_enabled) {
    notes.push('totp_enabled is TRUE — step 2 needs a code from the authenticator that '
      + 'enrolled this account. If that authenticator is gone, no password will get you in; '
      + 'rerun with --reset to clear the secret and re-enrol.');
  }
  if (!notes.length) {
    notes.push('nothing in the account state blocks login — the password itself is the likely cause.');
  }
  return notes;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // The app role is enough for everything here, so no migrator credential is
  // required — but prefer one when the operator has it.
  const url = process.env.DATABASE_MIGRATOR_URL
    || process.env.DATABASE_OWNER_URL
    || process.env.DATABASE_URL;
  if (!url) fail('no DATABASE_URL (or DATABASE_MIGRATOR_URL) in the environment.');
  if (process.env.NODE_ENV === 'test') fail('refusing to run under NODE_ENV=test.');

  const email = (args.check || args.verify || args.email || '').trim().toLowerCase();
  if (!email) {
    fail('usage:\n'
      + '    node scripts/create-superadmin.js --check <email>\n'
      + '    node scripts/create-superadmin.js --verify <email>\n'
      + '    node scripts/create-superadmin.js --email <email> --name "Full Name"\n'
      + '    node scripts/create-superadmin.js --email <email> --reset');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('"' + email + '" is not an email address.');
  if (!ALLOWED_ROLES.includes(args.role)) fail('--role must be one of ' + ALLOWED_ROLES.join(', '));

  const client = new Client({
    connectionString: url,
    application_name: 'panditsuggest-create-superadmin',
    ssl: sslConfig(url),
  });
  await client.connect();

  try {
    const { rows: [ctx] } = await client.query(
      'SELECT current_database() AS db, current_user AS usr');
    console.log('[create-superadmin] ' + ctx.usr + '@' + ctx.db);

    // auth_find_user_by_email is SECURITY DEFINER — the same lookup the login
    // flow uses, and the only way to read a row before any identity exists.
    const { rows: found } = await client.query(
      'SELECT * FROM auth_find_user_by_email($1)', [email]);
    const existing = found[0] || null;

    if (args.check) {
      if (!existing) {
        console.log('\nNo account for ' + email + ' (or it is soft-deleted).\n');
        return;
      }
      console.log('\nAccount found:');
      printUser(existing);
      console.log('\nWhy a login would fail:');
      diagnose(existing).forEach((n) => console.log('  - ' + n));
      console.log('');
      return;
    }

    // Replays step 1 of the admin login against this database, in the same
    // order and with the same two tests: repositories/admin/auth.repository.js
    // findAdminByEmail (lookup + role gate), then bcrypt.compare. Both failures
    // produce the identical generic 401 over HTTP, which is correct for an
    // attacker and useless for an operator — this separates them.
    if (args.verify) {
      if (!existing) {
        console.log('\nNo account for ' + email + ' in THIS database.');
        console.log('The lookup the login runs (auth_find_user_by_email) returns nothing,');
        console.log('so the 401 comes from step 1 finding no user at all — not the password.\n');
        return;
      }
      console.log('\nAccount found:');
      printUser(existing);
      const hash = existing.password_hash || '';
      console.log('    password_hash  ' + (hash
        ? 'present (' + hash.slice(0, 7) + '...)'
        : 'MISSING — no password will ever match'));

      const roleOk = ALLOWED_ROLES.includes(existing.role);
      console.log('\nrole gate       ' + (roleOk ? 'PASS' : 'FAIL — login returns 401 before checking the password'));
      if (!roleOk || !hash) {
        console.log('');
        return;
      }

      const candidate = (await readSecret('\nPassword to test: ')).trim();
      const match = await bcrypt.compare(candidate, hash);
      console.log('password check  ' + (match ? 'PASS' : 'FAIL — this is not the stored password'));
      if (match) {
        console.log('\nStep 1 would succeed. If the panel still refuses you, the failure is at');
        console.log('step 2 (the authenticator code) or the request is reaching a different backend.');
        if (existing.status !== 'active') {
          console.log('Note: status is "' + existing.status + '" — step 1 returns 403, not 401.');
        }
      } else {
        console.log('\nRerun with --email ' + email + ' --reset to set a password you know.');
      }
      console.log('');
      return;
    }

    if (existing && !args.reset) {
      console.log('\nAn account already exists for ' + email + ':');
      printUser(existing);
      fail('refusing to overwrite it. Rerun with --reset to set a new password, '
        + 'restore the role/status, and clear the MFA secret.');
    }

    console.log('\n' + (existing ? 'Resetting ' : 'Creating ') + args.role + ' for ' + email + '.');
    console.log('The password is read without echo and is never written to disk, logged, or printed.');
    console.log('Minimum length ' + MIN_PASSWORD_LENGTH + '. Use a password manager.\n');

    let pw;
    if (args.pwStdin) {
      pw = (await readAllStdin()).replace(/\r?\n$/, '');
      if (!pw) fail('--password-from-stdin given but stdin was empty. Nothing was written.');
      console.log('Password read from stdin (not echoed).');
    } else {
      pw = (await readSecret('New password: ')).trim();
      const pw2 = (await readSecret('Confirm     : ')).trim();
      if (pw !== pw2) fail('passwords did not match. Nothing was written.');
    }
    if (pw.length < MIN_PASSWORD_LENGTH) {
      fail('password is ' + pw.length + ' characters; minimum is '
        + MIN_PASSWORD_LENGTH + '. Nothing was written.');
    }
    if (/^[a-z]+$/i.test(pw) || /^[0-9]+$/.test(pw)) {
      fail('password is a single character class. Nothing was written.');
    }

    // Cost 12, matching bootstrap-superadmin.js — not the 10 the older
    // create-admin.js scripts use.
    const hash = await bcrypt.hash(pw, 12);
    const userId = existing ? existing.id : crypto.randomUUID();

    await setUserContext(client, userId);
    await client.query('BEGIN');

    let saved;
    if (existing) {
      const { rows } = await client.query(
        `UPDATE public.users
            SET password_hash = $2,
                role = $3::user_role,
                status = 'active',
                email_verified = TRUE,
                totp_enabled = FALSE,
                totp_secret_encrypted = NULL
          WHERE id = $1
        RETURNING id, email, full_name, role, status, email_verified, totp_enabled`,
        [userId, hash, args.role]);
      saved = rows[0];
      if (!saved) fail('the UPDATE matched no row — the connected role is not permitted to write it.');
    } else {
      const fullName = (args.name || '').trim();
      if (!fullName) fail('--name is required when creating a new account.');
      const { rows } = await client.query(
        `INSERT INTO public.users
           (id, email, full_name, role, status, password_hash,
            email_verified, phone_verified, totp_enabled, totp_secret_encrypted)
         VALUES ($1, $2, $3, $4::user_role, 'active', $5,
                 TRUE, FALSE, FALSE, NULL)
         RETURNING id, email, full_name, role, status, email_verified, totp_enabled`,
        [userId, email, fullName, args.role, hash]);
      saved = rows[0];
    }

    // Any session or half-finished MFA challenge on this account predates the
    // new credential and must not survive it.
    await client.query(
      `UPDATE admin_sessions SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    await client.query(
      `UPDATE admin_mfa_challenges SET consumed_at = NOW()
        WHERE user_id = $1 AND consumed_at IS NULL`, [userId]);

    await client.query('COMMIT');

    // Read the row back through the login's OWN lookup rather than trusting
    // RETURNING. A write that commits and a row the login can actually find
    // are two different claims, and only the second one matters — the first
    // run of this script left an operator staring at "Invalid credentials"
    // with no way to tell which of the two had failed.
    const { rows: readBack } = await client.query(
      'SELECT * FROM auth_find_user_by_email($1)', [email]);
    if (!readBack[0]) {
      fail('the row was written but auth_find_user_by_email() cannot see it. '
        + 'The admin login uses that exact lookup, so it would still refuse this account.');
    }

    console.log('\n[create-superadmin] ' + (existing ? 'reset:' : 'created:'));
    printUser(saved);
    console.log('\nRead back through auth_find_user_by_email() — the login\'s own lookup');
    console.log('finds this account, so step 1 now comes down to the password alone.');
    console.log('\nOld admin sessions revoked; pending MFA challenges consumed.');
    console.log('totp_enabled is FALSE, so the FIRST login shows a fresh authenticator');
    console.log('secret/QR at the password step — scan it before entering the 6-digit code.\n');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection may already be gone */ }
    fail('failed: ' + err.message);
  } finally {
    await client.end();
  }
}

main().catch((e) => fail(e.message));
