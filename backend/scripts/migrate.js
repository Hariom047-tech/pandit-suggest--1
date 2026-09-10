#!/usr/bin/env node
/**
 * Exactly-once migration runner.
 *
 * Replaces the previous model, which re-executed every file in src/db on every
 * deployment. That model had no ledger, no checksum and no lock, so: an edited
 * migration was silently re-applied with its new contents, two overlapping
 * deploys ran DDL concurrently, and one non-idempotent file (25) permanently
 * blocked every migration after it.
 *
 * Contract
 * --------
 *   applied, checksum matches   -> skip
 *   applied, checksum differs   -> ABORT the deployment (never "fix" in place)
 *   not applied                 -> BEGIN; run; verify; record; COMMIT
 *   anything fails              -> ROLLBACK, stop, do not touch later versions
 *
 * Sources, in version order:
 *   src/db/baseline/0000-*.sql    the entire production schema, applied once
 *   src/db/config/0001-*.sql      system/reference configuration, applied once
 *   src/db/migrations/NNNN-*.sql  everything after launch
 *
 * src/db/historical/ is NEVER read. Those 36 files are provenance only.
 *
 * Usage:
 *   DATABASE_MIGRATOR_URL=postgresql://panditsuggest_migrator@host/db npm run db:migrate
 *   npm run db:migrate -- --dry-run
 */
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { Client } = require('pg');

const DB_DIR = path.join(__dirname, '..', 'src', 'db');
const SOURCES = ['baseline', 'config', 'migrations'];

// One constant for the whole project. Two migrators contend on this and the
// loser waits rather than running DDL alongside the winner.
const ADVISORY_LOCK_KEY = 8145326701923847n;

const DRY_RUN = process.argv.includes('--dry-run');

function fail(msg) {
  console.error(`\n[migrate] FATAL: ${msg}\n`);
  process.exit(1);
}

/** Every runnable file, in deterministic version order. */
function discover() {
  const found = new Map();
  for (const dir of SOURCES) {
    const full = path.join(DB_DIR, dir);
    if (!fs.existsSync(full)) continue;
    for (const filename of fs.readdirSync(full).sort()) {
      const m = /^(\d{4})-.*\.sql$/.exec(filename);
      if (!m) continue;
      const version = m[1];
      if (found.has(version)) {
        fail(`duplicate migration version ${version}: `
          + `${found.get(version).relPath} and ${dir}/${filename}`);
      }
      const abs = path.join(full, filename);
      const body = fs.readFileSync(abs);
      found.set(version, {
        version,
        filename,
        relPath: `${dir}/${filename}`,
        body: body.toString('utf8'),
        // Checksum over raw BYTES, so a line-ending change is caught too.
        checksum: crypto.createHash('sha256').update(body).digest('hex'),
        // Opt-out for statements Postgres forbids inside a transaction block
        // (CREATE INDEX CONCURRENTLY, ALTER TYPE ... ADD VALUE).
        noTransaction: /^--\s*migrate:no-transaction\s*$/m.test(body.toString('utf8')),
      });
    }
  }
  // Zero-padded 4-digit versions sort correctly as strings well past 9999
  // files; the old runner's plain .sort() broke at 100.
  return [...found.values()].sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * Splits a migration into individual statements.
 *
 * Only needed for `-- migrate:no-transaction` files. node-pg sends a
 * multi-statement string as ONE simple-query message, and PostgreSQL wraps
 * such a message in an implicit transaction block — which is precisely what
 * CREATE INDEX CONCURRENTLY and ALTER TYPE ... ADD VALUE refuse to run inside.
 * Sending the statements one at a time is the only way they see true autocommit.
 *
 * Respects dollar-quoted bodies ($$ ... $$, $tag$ ... $tag$), single-quoted
 * literals with '' escapes, line comments and block comments — all of which
 * appear in these files and all of which can contain a semicolon.
 */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);

    // line comment
    if (rest.startsWith('--')) {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? sql.length : nl + 1;
      buf += sql.slice(i, end); i = end; continue;
    }
    // block comment
    if (rest.startsWith('/*')) {
      const close = sql.indexOf('*/', i + 2);
      const end = close === -1 ? sql.length : close + 2;
      buf += sql.slice(i, end); i = end; continue;
    }
    // single-quoted literal
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      buf += sql.slice(i, j); i = j; continue;
    }
    // dollar-quoted body
    const dq = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (dq) {
      const tag = dq[0];
      const close = sql.indexOf(tag, i + tag.length);
      const end = close === -1 ? sql.length : close + tag.length;
      buf += sql.slice(i, end); i = end; continue;
    }
    // statement boundary
    if (sql[i] === ';') { out.push(buf); buf = ''; i += 1; continue; }

    buf += sql[i]; i += 1;
  }
  if (buf.trim()) out.push(buf);
  // Drop fragments that are only whitespace and comments (the long headers on
  // these files). Done line-by-line rather than with a regex: the obvious
  // pattern for this nests two quantifiers and backtracks catastrophically on
  // a 30-line comment block, which hung the runner for minutes.
  return out.filter((st) => st
    .split('\n')
    .some((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('--');
    }));
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version       VARCHAR(16)  PRIMARY KEY,
      filename      TEXT         NOT NULL,
      checksum      VARCHAR(64)  NOT NULL,
      applied_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      execution_ms  INTEGER,
      applied_by    TEXT,
      deployment_id TEXT
    )`);
}

async function main() {
  const url = process.env.DATABASE_MIGRATOR_URL || process.env.DATABASE_OWNER_URL;
  if (!url) {
    fail('DATABASE_MIGRATOR_URL is not set.\n'
      + '  Migrations run as panditsuggest_migrator, never as the runtime app role\n'
      + '  and never as the RDS master user. In production the value comes from\n'
      + '  AWS Secrets Manager — see docs/PRODUCTION_DB_RUNBOOK.md.\n'
      + '  There is deliberately no default: the previous runner fell back to a\n'
      + '  hardcoded production superuser URL.');
  }

  const migrations = discover();
  if (!migrations.length) fail(`no migration files found under ${DB_DIR}`);

  const client = new Client({
    connectionString: url,
    application_name: 'panditsuggest-migrate',
    ssl: sslConfig(url),
  });
  client.on('notice', (n) => console.log(`    ${n.message}`));
  await client.connect();

  try {
    // --- identity -----------------------------------------------------------
    const { rows: [ident] } = await client.query(
      `SELECT current_database() AS db, current_user AS usr,
              inet_server_addr()::text AS host, version() AS ver,
              current_setting('server_version_num')::int AS vernum`);
    console.log(`[migrate] ${ident.usr}@${ident.host || 'local'}/${ident.db}`);
    console.log(`[migrate] ${ident.ver.split(',')[0]}`);

    if (ident.vernum < 160000) {
      fail(`server is PostgreSQL ${ident.vernum}; this schema targets 16+`);
    }

    // A migrator must never be the runtime role.
    if (ident.usr === 'panditsuggest_app' || ident.usr === 'panditconnect_app') {
      fail(`refusing to migrate as the runtime application role "${ident.usr}"`);
    }

    // Never let a test process migrate anything.
    if (process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_MIGRATIONS !== 'yes') {
      fail('NODE_ENV=test: refusing to run migrations. Set ALLOW_TEST_MIGRATIONS=yes '
        + 'only for a disposable CI database.');
    }

    // --- lock ---------------------------------------------------------------
    await applySessionPolicy(client);

    const { rows: [lock] } = await client.query(
      'SELECT pg_try_advisory_lock($1) AS got', [ADVISORY_LOCK_KEY.toString()]);
    if (!lock.got) {
      fail('another migration process holds the advisory lock. '
        + 'Two deployments must never migrate concurrently — this one is stopping.');
    }
    console.log('[migrate] advisory lock acquired');

    try {
      await ensureLedger(client);

      const { rows: applied } = await client.query(
        'SELECT version, filename, checksum FROM public.schema_migrations');
      const ledger = new Map(applied.map((r) => [r.version, r]));

      // --- checksum enforcement, over the WHOLE set, before applying anything.
      // A tampered 0007 must stop the deploy even if only 0009 is pending.
      const drifted = [];
      for (const m of migrations) {
        const prior = ledger.get(m.version);
        if (prior && prior.checksum !== m.checksum) drifted.push({ m, prior });
      }
      if (drifted.length) {
        for (const { m, prior } of drifted) {
          console.error(`\n  ${m.relPath}`);
          console.error(`    applied as : ${prior.filename}`);
          console.error(`    recorded   : ${prior.checksum}`);
          console.error(`    on disk    : ${m.checksum}`);
        }
        fail(`${drifted.length} already-applied migration(s) changed on disk.\n`
          + '  An applied migration is immutable. Revert the edit and add a new\n'
          + '  migration that makes the change forward. See docs/MIGRATION_RULES.md.');
      }

      const pending = migrations.filter((m) => !ledger.has(m.version));
      console.log(`[migrate] ${migrations.length} known, ${ledger.size} applied, ${pending.length} pending`);

      if (!pending.length) { console.log('[migrate] nothing to do.'); return; }
      if (DRY_RUN) {
        pending.forEach((m) => console.log(`  would apply ${m.version}  ${m.relPath}`));
        return;
      }

      const appliedBy = `${ident.usr}@${os.hostname()}`;
      const deploymentId = process.env.DEPLOYMENT_ID || null;

      for (const m of pending) {
        process.stdout.write(`  ${m.version}  ${m.relPath} ... `);
        const started = Date.now();

        // The migration and its ledger row commit together or not at all —
        // there is no window in which the schema moved but the record did not.
        if (!m.noTransaction) await client.query('BEGIN');
        try {
          if (m.noTransaction) {
            // One statement per message, so each gets its own implicit
            // transaction and CONCURRENTLY builds are legal.
            for (const stmt of splitStatements(m.body)) {
              await client.query(stmt);
            }
          } else {
            await client.query(m.body);
          }

          // Undo session state the migration left behind, before the ledger
          // write and before the next file runs.
          //
          // This is not hygiene, it is a safety requirement. A pg_dump-produced
          // file (the baseline is one) opens with a preamble of plain SETs that
          // are session-wide, not transaction-local:
          //
          //   statement_timeout = 0    disables this runner's 15min ceiling
          //   lock_timeout = 0         disables the 10s ceiling — a later
          //                            migration could then block the live site
          //                            indefinitely instead of failing fast
          //   row_security = off       makes any later query touching an RLS
          //                            table fail outright
          //   search_path = ''         breaks every unqualified table name
          //   check_function_bodies    stops validating function bodies
          //
          // All five were observed leaking out of 0000 into 0001 on a fresh
          // database (scratch A/B), which is exactly the cutover path.
          await client.query('RESET ROLE');
          await applySessionPolicy(client);
          const ms = Date.now() - started;
          await client.query(
            `INSERT INTO public.schema_migrations
               (version, filename, checksum, execution_ms, applied_by, deployment_id)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [m.version, m.relPath, m.checksum, ms, appliedBy, deploymentId]);
          if (!m.noTransaction) await client.query('COMMIT');
          console.log(`ok (${ms} ms)`);
        } catch (err) {
          if (!m.noTransaction) {
            try { await client.query('ROLLBACK'); } catch { /* connection may be gone */ }
          }
          console.log('FAILED');
          console.error(`\n[migrate] ${m.relPath} failed: ${err.message}`);
          if (err.detail) console.error(`  detail: ${err.detail}`);
          if (err.hint) console.error(`  hint:   ${err.hint}`);
          if (m.noTransaction) {
            console.error('\n  This file is marked migrate:no-transaction, so it was NOT\n'
              + '  rolled back. Inspect the database before retrying.');
          }
          fail(`stopped at ${m.version}. ${pending.length - pending.indexOf(m) - 1} later `
            + 'migration(s) were not attempted.');
        }
      }
      console.log(`[migrate] applied ${pending.length} migration(s).`);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY.toString()]);
      console.log('[migrate] advisory lock released');
    }
  } finally {
    await client.end();
  }
}

/**
 * The session settings a migration runs under. Re-asserted after every file,
 * because a pg_dump-produced migration resets several of them session-wide.
 */
async function applySessionPolicy(client) {
  await client.query("SET lock_timeout = '10s'");
  await client.query("SET statement_timeout = '15min'");
  await client.query("SET idle_in_transaction_session_timeout = '60s'");
  await client.query('SET row_security = on');
  await client.query('SET check_function_bodies = on');
  await client.query('RESET search_path');
}

/** RDS requires TLS with real CA verification. Local docker has no TLS. */
function sslConfig(url) {
  if (!/rds\.amazonaws\.com/.test(url) && process.env.PGSSLMODE !== 'verify-full') return false;
  const caPath = process.env.RDS_CA_BUNDLE
    || path.join(__dirname, '..', '..', 'certs', 'rds-global-bundle.pem');
  if (!fs.existsSync(caPath)) {
    fail(`RDS connection requires the CA bundle at ${caPath}.\n`
      + '  Download: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem\n'
      + '  rejectUnauthorized:false is not an acceptable substitute.');
  }
  return { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') };
}

main().catch((err) => { console.error(err); process.exit(1); });
