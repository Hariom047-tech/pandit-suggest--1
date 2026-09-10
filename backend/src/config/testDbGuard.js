/**
 * Refuses to let test code connect to a non-test database.
 *
 * The incident this exists to prevent has already happened once: a test run
 * pointed at the database production actually serves and left ~250 fake
 * pandit/user/temple/payment rows live. By the time of the pre-RDS audit that
 * had grown to 633 of 637 users being fixtures.
 *
 * The previous version of this guard had the right shape but three holes, all
 * of which are closed below:
 *
 *   1. It returned early unless NODE_ENV === 'test' — and NINE of the
 *      `npm run test:*` scripts did not set NODE_ENV, so the guard was simply
 *      inactive for them. It now detects a test runner on its own and treats
 *      a missing NODE_ENV as a failure, not as permission.
 *   2. It checked only the database NAME. An RDS instance can host a database
 *      called anything, so the name alone proves nothing.
 *   3. Nothing stopped a test pointing at a remote host at all.
 *
 * Layers, in order. The first three are pure string checks on the resolved
 * connection string, so they fire BEFORE a socket is opened and long before
 * any SQL executes — which is the requirement for the RDS production instance.
 * The fourth runs after connect, as a backstop.
 */

const REQUIRED_TEST_DB_NAME = 'panditconnect_test';
const PRODUCTION_DB_NAMES = ['panditconnect', 'panditsuggest', 'panditsuggest_prod'];

/** Hosts a test must never reach, whatever the database is called. */
const FORBIDDEN_HOST_PATTERNS = [
  /\.rds\.amazonaws\.com$/i,   // any AWS RDS endpoint
  /\.rds\.amazonaws\.com:/i,
  /amazonaws\.com/i,
];

function parts(connectionString) {
  const s = connectionString || '';
  const withoutQuery = s.split('?')[0];
  const dbName = withoutQuery.split('/').pop() || '';
  let host = '';
  const m = /^[a-z+]+:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(s);
  if (m) host = m[1];
  return { dbName, host };
}

/**
 * True when this process is running tests, whether or not anyone remembered
 * to set NODE_ENV. Deliberately generous: a false positive costs a developer
 * one explicit env var, a false negative costs production data.
 */
function looksLikeTestRun() {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.DATABASE_ENV === 'test') return true;
  if (process.env.NODE_TEST_CONTEXT) return true;              // node --test sets this in children
  if (process.argv.some((a) => a === '--test' || a.startsWith('--test-'))) return true;
  const script = process.env.npm_lifecycle_event || '';
  if (script === 'test' || script.startsWith('test:')) return true;
  if (process.argv.some((a) => /\.test\.(js|mjs|cjs)$/.test(a))) return true;
  return false;
}

function refuse(lines) {
  console.error(`\n[FATAL] Refusing to run.\n\n${lines.join('\n')}\n`);
  process.exit(1);
}

/** Call once, immediately before a pool is created from `connectionString`.
 *  A no-op outside a test run, so the live application is never affected. */
function assertSafeForTests(connectionString, label) {
  if (!looksLikeTestRun()) return;

  const { dbName, host } = parts(connectionString);
  // Never log the connection string itself — it carries the password.
  const where = `${label} -> host "${host || '(none)'}", database "${dbName || '(unset)'}"`;

  // Layer 1 — both markers must be set EXPLICITLY. Absence is not consent.
  if (process.env.NODE_ENV !== 'test') {
    refuse([
      'This looks like a test run, but NODE_ENV is not "test".',
      `  NODE_ENV = ${JSON.stringify(process.env.NODE_ENV)}`,
      '',
      'Nine npm scripts once omitted NODE_ENV=test, which disabled this guard',
      'entirely and is how fixture rows reached production. Set it explicitly:',
      '  NODE_ENV=test DATABASE_ENV=test npm run test:...',
    ]);
  }
  if (process.env.DATABASE_ENV !== 'test') {
    refuse([
      'NODE_ENV=test but DATABASE_ENV is not "test".',
      `  DATABASE_ENV = ${JSON.stringify(process.env.DATABASE_ENV)}`,
      '',
      'DATABASE_ENV is a second, independent marker so that a stray NODE_ENV',
      'in a shell profile cannot by itself authorise writes to a database.',
    ]);
  }

  // Layer 2 — never a managed/remote endpoint, whatever it is called.
  if (FORBIDDEN_HOST_PATTERNS.some((re) => re.test(host))) {
    refuse([
      'A test process tried to connect to a managed AWS endpoint.',
      `  ${where}`,
      '',
      'Production runs on AWS RDS. Tests never touch it, under any database',
      'name. This check is a string comparison on the connection string, so it',
      'fires before a socket is opened and before any SQL runs.',
    ]);
  }

  // Layer 3 — and the database must be the dedicated test one.
  if (PRODUCTION_DB_NAMES.includes(dbName) || dbName !== REQUIRED_TEST_DB_NAME) {
    refuse([
      `A test process resolved to database "${dbName || '(unset)'}", not the`,
      `dedicated test database "${REQUIRED_TEST_DB_NAME}".`,
      `  ${where}`,
      '',
      'The fixtures in tests/ do not clean up after themselves. That is fine',
      'against a disposable database and catastrophic against any other.',
    ]);
  }
}

/**
 * Layer 4 — backstop, after a connection exists.
 *
 * Reads the single-row deployment_environment marker written at cutover. A
 * name and a host can both be spoofed by a copied .env; the marker travels
 * with the database itself, so a restored production snapshot is still
 * recognisably production. Call once from the test bootstrap.
 */
async function assertNotProductionDatabase(query, label = 'test bootstrap') {
  if (!looksLikeTestRun()) return;
  let env;
  try {
    const { rows } = await query(
      "SELECT environment FROM public.deployment_environment LIMIT 1");
    env = rows[0] && rows[0].environment;
  } catch {
    // No marker table (an old or half-built scratch DB). Layers 1-3 already
    // established this is not production; treat as unmarked and continue.
    return;
  }
  if (env === 'production' || env === 'staging') {
    refuse([
      `The connected database identifies itself as "${env}".`,
      `  ${label}`,
      '',
      'deployment_environment is written at cutover and travels with the data,',
      'so this fires even on a restored production snapshot with a test-looking',
      'name. Nothing has been written.',
    ]);
  }
}

module.exports = {
  assertSafeForTests,
  assertNotProductionDatabase,
  looksLikeTestRun,
  REQUIRED_TEST_DB_NAME,
  PRODUCTION_DB_NAMES,
};
