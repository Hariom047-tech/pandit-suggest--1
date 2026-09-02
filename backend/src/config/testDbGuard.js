/**
 * Refuses to let NODE_ENV=test code connect to the production database.
 *
 * Incident this exists to prevent: this project's Postgres server has only
 * ONE instance and the test suite's fixtures (makePandit(), raw INSERTs in
 * sitemap.test.js/render.test.js/etc) don't self-clean — fine against a
 * disposable database, not fine against production. A prior session pointed
 * DATABASE_URL at the same "panditconnect" database production actually
 * serves (it's reachable at the same host:port a local dev setup would also
 * use, since there's no separate physical test instance) and a full test run
 * left ~250 fake pandit/user/temple/payment rows live. See
 * docs/SEO_ARCHITECTURE.md for the cleanup.
 *
 * The fix is a dedicated "panditconnect_test" database (same Postgres
 * server, cloned schema, no production data — see backend/README or
 * .env.test.example) plus this guard, which is a synchronous string check on
 * the resolved connection string's database name — no network round trip,
 * so it can't race a test that starts before an async check resolves. It
 * fires the instant config/db.js or tests/helpers.js loads, before any pool
 * is even constructed.
 */
const PRODUCTION_DB_NAME = 'panditconnect';
const REQUIRED_TEST_DB_NAME = 'panditconnect_test';

function dbNameFromConnectionString(connectionString) {
  const withoutQuery = (connectionString || '').split('?')[0];
  return withoutQuery.split('/').pop() || '';
}

/** Call once, right where a pool is about to be created from `connectionString`.
 *  A no-op outside NODE_ENV=test (never affects the real running app). */
function assertSafeForTests(connectionString, label) {
  if (process.env.NODE_ENV !== 'test') return;

  const dbName = dbNameFromConnectionString(connectionString);

  if (dbName === PRODUCTION_DB_NAME || dbName !== REQUIRED_TEST_DB_NAME) {
    // Deliberately no credentials logged — just the database name, which
    // isn't a secret.
    console.error(
      `\n[FATAL] Refusing to run: NODE_ENV=test but ${label} resolves to database "${dbName || '(unset)'}", ` +
      `not the required dedicated test database "${REQUIRED_TEST_DB_NAME}".\n` +
      `This guard exists because a prior test run pointed at the production database and left fake data live.\n` +
      `Set the connection string to end in "/${REQUIRED_TEST_DB_NAME}" before running tests ` +
      `(see backend/.env.test.example).\n`
    );
    process.exit(1);
  }
}

module.exports = { assertSafeForTests, PRODUCTION_DB_NAME, REQUIRED_TEST_DB_NAME };
