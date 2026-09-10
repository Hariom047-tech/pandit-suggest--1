const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
// Guarantees .env/.env.test has been loaded before reading process.env.
// DATABASE_URL below, regardless of which file required config/db.js first —
// without this, a test file that requires tests/helpers.js (which requires
// this module) before anything else triggers dotenv left DATABASE_URL unset
// here, which used to silently fall through to the hardcoded default below.
// That default happens to be the production database name, so an unset
// DATABASE_URL and a misconfigured one were indistinguishable — exactly the
// gap testDbGuard.js exists to close, so this module must never read
// DATABASE_URL before dotenv has had a chance to run.
//
// Deliberately requires ./loadEnv, NOT the full ./env — this module only
// needs the dotenv side-effect, not ./env's OTHER required() checks
// (ADMIN_SECRET_PATH, ENCRYPTION_KEY), which are unrelated to database
// connectivity. Pulling in the full module broke a rate-limiter test that
// deliberately simulates an unconfigured production environment (caught
// live: "unset NODE_ENV behaves like production" started throwing on an
// unrelated missing var the moment this file transitively reached it via
// middleware/security.js -> utils/securityLog.js -> config/db.js).
require('./loadEnv');
const { assertSafeForTests } = require('./testDbGuard');

// The fallback below used to be a full production connection string, so an
// unset DATABASE_URL silently connected to production — the exact ambiguity
// testDbGuard exists to close. It now falls back only outside production, and
// only to a name that is obviously local.
const connectionString = process.env.DATABASE_URL
  || (process.env.NODE_ENV === 'production'
        ? (() => {
            console.error('\n[FATAL] NODE_ENV=production but DATABASE_URL is not set. '
              + 'Refusing to guess a database.\n');
            process.exit(1);
          })()
        : 'postgresql://panditsuggest_app@localhost:5433/panditconnect_dev');

// See testDbGuard.js: NODE_ENV=test connecting to the real "panditconnect"
// database has actually happened (it left ~250 fake rows live in
// production) — this is the fail-safe so it can't happen silently again.
assertSafeForTests(connectionString, 'DATABASE_URL (config/db.js)');

/**
 * TLS for RDS, with real CA verification.
 *
 * `rejectUnauthorized: false` would encrypt the traffic and authenticate
 * nothing, which against a private RDS endpoint is worse than useless — it is
 * the appearance of security. The RDS CA bundle is downloaded to certs/ at
 * deploy time (see docs/AWS_RDS_RUNBOOK.md); if it is missing we refuse to
 * connect rather than silently falling back to an unverified session.
 */
function sslConfig(url) {
  const wantsTls = /rds\.amazonaws\.com/.test(url) || process.env.PGSSLMODE === 'verify-full';
  if (!wantsTls) return false;              // local docker postgres has no TLS
  const caPath = process.env.RDS_CA_BUNDLE
    || path.join(__dirname, '..', '..', '..', 'certs', 'rds-global-bundle.pem');
  if (!fs.existsSync(caPath)) {
    console.error(
      `\n[FATAL] TLS is required for this database but the RDS CA bundle is missing at ${caPath}.\n`
      + '  Download it with:\n'
      + '    curl -o certs/rds-global-bundle.pem \\\n'
      + '      https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem\n'
      + '  Refusing to connect without CA verification.\n');
    process.exit(1);
  }
  return { rejectUnauthorized: true, ca: fs.readFileSync(caPath, 'utf8') };
}

const pool = new Pool({
  connectionString,
  ssl: sslConfig(connectionString),

  // Every one of these was previously a node-pg default. The comments record
  // what the default actually cost, because none of them are arbitrary.

  // 10 was the default too, but stated explicitly so the connection budget is
  // reviewable: max_connections on a db.t4g.small is ~100, and a rolling
  // deploy runs old and new instances at once. 4 instances x 10 x 2 (deploy
  // overlap) = 80, plus the migrator and a psql session or two. That fits;
  // 5 instances does not. Revisit (or add RDS Proxy) before scaling past 4.
  max: Number(process.env.PGPOOL_MAX || 10),

  // Was 0 = wait forever. A saturated pool then hangs the request instead of
  // failing it, so the symptom is a silent stall rather than a 503.
  connectionTimeoutMillis: 5000,

  idleTimeoutMillis: 30000,

  // RDS sits behind a NAT/ELB idle timeout; without keepalives a pooled
  // connection can be reaped server-side and only discovered on next use.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,

  // Server-side ceilings, applied per connection. Server defaults are all 0
  // (unlimited), which is how one runaway query or one leaked transaction
  // takes the whole site down.
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 30000),
  idle_in_transaction_session_timeout: 60000,
  lock_timeout: 5000,

  // So pg_stat_activity can tell the API apart from a migration or a script.
  application_name: process.env.PG_APPLICATION_NAME || 'panditsuggest-api',
});

pool.on('error', (err) => {
  // a broken idle client shouldn't crash the whole API process
  console.error('[panditconnect-backend] unexpected Postgres pool error:', err);
});

/**
 * Runs `fn(query)` inside a transaction with a Postgres setting set via
 * SET LOCAL (through set_config's third arg), so Row-Level Security policies
 * (see 01-schema.sql) that read it via current_setting(..., true) can see
 * who's asking. SET LOCAL only lives for the current transaction, so this
 * needs one checked-out client + an explicit BEGIN/COMMIT rather than
 * pool.query() (which hands back a random client per call).
 */
async function withSetting(name, value, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', [name, value || '']);
    const result = await fn((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Sets app.current_user_id, which current_app_user_id() (01-schema.sql)
 *  reads for "is this my own row" RLS policies. Pass userId = null for "no
 *  identity" (RLS then treats the request as anonymous). */
function withUserContext(userId, fn) {
  return withSetting('app.current_user_id', userId, fn);
}

/**
 * Sets BOTH identity settings in one transaction, for the AI assistant.
 *
 * The assistant serves logged-in users and guests through the same code path,
 * and a guest has no user id — their only identity is an opaque session key.
 * Migration 13's policies compare that key per row via
 * current_app_session_key(), so it has to be set on the same connection, inside
 * the same transaction, as the query it guards.
 *
 * withSetting() only carries one value, and nesting two of them would check out
 * two clients and put the settings on different connections — where the policy
 * would read an unset GUC and deny every row.
 *
 * Fails closed by design: forget to pass sessionKey and the guest simply
 * cannot read or write, rather than reading everyone else's conversations.
 */
async function withAiContext({ userId = null, sessionKey = null }, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId || '']);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_session_key', sessionKey || '']);
    const result = await fn((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  withSetting,
  withUserContext,
  withAiContext,
};
