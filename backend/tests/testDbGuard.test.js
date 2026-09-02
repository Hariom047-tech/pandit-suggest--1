/**
 * backend/src/config/testDbGuard.js — the fail-safe that stops NODE_ENV=test
 * code from ever connecting to the production database again (see that
 * file's own comment for the incident this exists to prevent).
 *
 * The guard calls process.exit(1) on failure, so it can't be exercised via a
 * plain require() in this process without killing the whole test run —
 * verified in a real child process instead, the same way a developer would
 * actually trigger it from the command line.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const dbPath = path.join(__dirname, '..', 'src', 'config', 'db.js');

function runWithDatabaseUrl(databaseUrl) {
  try {
    execFileSync(process.execPath, ['-e', `require(${JSON.stringify(dbPath)})`], {
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
    return { exitCode: 0, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stderr: err.stderr.toString() };
  }
}

test('testDbGuard: refuses to load config/db.js against the production database name', () => {
  const { exitCode, stderr } = runWithDatabaseUrl(
    'postgresql://panditconnect_app:panditconnect_app_dev@localhost:5433/panditconnect',
  );
  assert.equal(exitCode, 1);
  assert.match(stderr, /Refusing to run/);
  assert.match(stderr, /panditconnect_test/);
});

test('testDbGuard: refuses to load config/db.js with DATABASE_URL unset (falls back to the production default)', () => {
  try {
    execFileSync(process.execPath, ['-e', `require(${JSON.stringify(dbPath)})`], {
      env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '' },
      stdio: 'pipe',
    });
    assert.fail('expected the guard to exit(1)');
  } catch (err) {
    assert.equal(err.status, 1);
    assert.match(err.stderr.toString(), /Refusing to run/);
  }
});

test('testDbGuard: allows config/db.js to load when DATABASE_URL points at panditconnect_test', () => {
  const { exitCode } = runWithDatabaseUrl(
    'postgresql://panditconnect_app:panditconnect_app_dev@localhost:5433/panditconnect_test',
  );
  assert.equal(exitCode, 0);
});

test('testDbGuard: is a no-op outside NODE_ENV=test (never affects the real running app)', () => {
  execFileSync(process.execPath, ['-e', `require(${JSON.stringify(dbPath)})`], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      // Unrelated to this guard, but config/db.js now requires ./env at
      // load time (see its own comment) — env.js requires these two, with
      // no fallback, outside test mode. Real production sets them via
      // docker-compose; this subprocess needs its own stand-ins.
      ADMIN_SECRET_PATH: 'irrelevant-for-this-test',
      ENCRYPTION_KEY: '0'.repeat(64),
      DATABASE_URL: 'postgresql://panditconnect_app:panditconnect_app_dev@localhost:5433/panditconnect',
    },
    stdio: 'pipe',
  });
  // no throw = pool constructed normally, exactly as production expects
});
