#!/usr/bin/env node
/**
 * Creates the single genuine super-admin on a clean production database.
 *
 * Run ONCE, interactively, after the baseline and config are applied and
 * before the application is pointed at the database. This is deliberately not
 * a migration: a migration is a file in git that runs unattended on every
 * environment, which is the wrong shape for provisioning a human's credential.
 *
 *   DATABASE_MIGRATOR_URL=... node scripts/bootstrap-superadmin.js
 *
 * What is preserved from the legacy account: the identity only — email, name,
 * role. Nothing else is copied. Specifically NOT copied, by design:
 *
 *   password_hash          the legacy hash is not reused; a fresh password is
 *                          set here and never written to disk or printed
 *   totp_secret_encrypted  cleared, so the first admin login forces a fresh
 *                          MFA enrolment (controllers/admin/auth.controller.js
 *                          branches on !user.totp_enabled)
 *   sessions, reset tokens, OTP challenges, audit history — none migrate
 *
 * The password is read from stdin with echo disabled, so it never reaches
 * argv, the environment, shell history, or this process's output.
 *
 * For an unattended bootstrap (the RDS cutover runs from an automation host
 * with no TTY), pass --password-from-stdin and pipe the password in from a
 * secret store. That keeps the property that actually matters: the password is
 * never in argv, never in the environment, never written to disk, never
 * printed. It is a separate explicit flag rather than a silent fallback, so a
 * TTY-less run can never quietly read something unintended.
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

// The one legacy identity approved for production. Hardcoded rather than
// passed in, so a typo cannot silently provision a different account.
const IDENTITY = {
  email: 'patidarhariom047@gmail.com',
  fullName: 'Hariom Patidar',
  role: 'super_admin',
};

const MIN_PASSWORD_LENGTH = 16;

function fail(msg) {
  console.error('\n[bootstrap-superadmin] ' + msg + '\n');
  process.exit(1);
}

/**
 * Reads one line from the TTY with echo off, so the password is never
 * rendered, never enters shell history, and never appears in a screen share.
 */
function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('stdin is not a TTY. Run this interactively, or pass '
        + '--password-from-stdin to supply the password from a secret store.'));
      return;
    }
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let buf = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '') {                    // Ctrl-C
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
        if (ch === '' || ch === '\b') {     // backspace
          buf = buf.slice(0, -1);
        } else {
          buf += ch;
        }
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

async function main() {
  const url = process.env.DATABASE_MIGRATOR_URL || process.env.DATABASE_OWNER_URL;
  if (!url) fail('DATABASE_MIGRATOR_URL is not set.');
  if (process.env.NODE_ENV === 'test') fail('refusing to run under NODE_ENV=test.');

  const client = new Client({
    connectionString: url,
    application_name: 'panditsuggest-bootstrap-admin',
    ssl: sslConfig(url),
  });
  await client.connect();

  try {
    const { rows: [ctx] } = await client.query(
      'SELECT current_database() AS db, current_user AS usr');
    console.log('[bootstrap-superadmin] ' + ctx.usr + '@' + ctx.db);

    // --- refuse to run against anything that already has accounts -----------
    const { rows: [{ count }] } = await client.query(
      'SELECT count(*)::int AS count FROM public.users');
    if (count > 0) {
      const { rows } = await client.query(
        'SELECT email, role FROM public.users ORDER BY created_at LIMIT 10');
      console.error('\n[bootstrap-superadmin] users already exist:');
      rows.forEach((r) => console.error('    ' + r.email + '  (' + r.role + ')'));
      fail('refusing to run: this database already holds ' + count + ' user(s). '
        + 'This script only ever provisions the FIRST account on a clean database.');
    }

    // --- the operator supplies the password, out of band --------------------
    console.log('\nProvisioning ' + IDENTITY.role + ' for ' + IDENTITY.email
      + ' (' + IDENTITY.fullName + ').');
    console.log('The password is read without echo and is never written to disk, logged, or printed.');
    console.log('Minimum length ' + MIN_PASSWORD_LENGTH + '. Use a password manager.\n');

    let pw;
    if (process.argv.includes('--password-from-stdin')) {
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

    const hash = await bcrypt.hash(pw, 12);

    // --- create, in one transaction ----------------------------------------
    await client.query('BEGIN');
    const { rows: [created] } = await client.query(
      `INSERT INTO public.users
         (email, full_name, role, status, password_hash,
          email_verified, phone_verified, totp_enabled, totp_secret_encrypted)
       VALUES ($1, $2, $3::user_role, 'active', $4,
               TRUE, FALSE, FALSE, NULL)
       RETURNING id, email, full_name, role, status, email_verified, totp_enabled`,
      [IDENTITY.email, IDENTITY.fullName, IDENTITY.role, hash]);
    await client.query('COMMIT');

    console.log('\n[bootstrap-superadmin] created:');
    console.log('    id             ' + created.id);
    console.log('    email          ' + created.email);
    console.log('    name           ' + created.full_name);
    console.log('    role           ' + created.role);
    console.log('    status         ' + created.status);
    console.log('    email_verified ' + created.email_verified);
    console.log('    totp_enabled   ' + created.totp_enabled
      + '  <- first login will force MFA enrolment');
    console.log('\nNo session, reset token, OTP challenge or MFA secret was carried over.');
    console.log('Log in at the admin panel and complete TOTP enrolment now.\n');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection may already be gone */ }
    fail('failed: ' + err.message);
  } finally {
    await client.end();
  }
}

/**
 * RDS requires TLS with real CA verification, and rds.force_ssl = 1 rejects a
 * plaintext connection outright ("no pg_hba.conf entry ... no encryption").
 * Mirrors scripts/migrate.js — this script was missing it entirely and could
 * not connect to RDS at all.
 */
function sslConfig(url) {
  if (!/rds\.amazonaws\.com/.test(url) && process.env.PGSSLMODE !== 'verify-full') return false;
  const caPath = process.env.RDS_CA_BUNDLE
    || path.join(__dirname, '..', '..', 'certs', 'rds-global-bundle.pem');
  if (!fs.existsSync(caPath)) {
    fail('RDS connection requires the CA bundle at ' + caPath + '.\n'
      + '  Download: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem\n'
      + '  rejectUnauthorized:false is not an acceptable substitute.');
  }
  return { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') };
}

main().catch((e) => fail(e.message));
