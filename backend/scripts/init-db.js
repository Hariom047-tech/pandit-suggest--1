#!/usr/bin/env node
/**
 * Builds a database from scratch: baseline -> config -> pending migrations.
 *
 * This used to apply historical/01-schema.sql, 02-seed.sql and a hardcoded
 * list of the next seven migrations. All three parts of that are now wrong:
 *
 *   - 01-schema.sql could not build an empty database at all (a function
 *     forward-referenced a table created 31 lines later), so this script's
 *     single-query-per-file style rolled the whole thing back and produced an
 *     EMPTY database while reporting success
 *   - 02-seed.sql is demo content — 23 users sharing one committed bcrypt
 *     hash, including an active admin. It must never reach any environment
 *     that could be mistaken for production
 *   - the hardcoded file list stopped at 09, so a database built this way was
 *     missing migrations 10-36 entirely
 *
 * The bootstrap path is now baseline/0000 + config/0001 + migrations/, applied
 * exactly once each and recorded in schema_migrations. That is one code path
 * for CI, development, staging and production, which is the only way any of
 * them proves anything about the others.
 *
 * This script is a thin, friendly wrapper around that. It exists for the case
 * the original was written for: a Postgres that was NOT freshly created by the
 * compose image, so /docker-entrypoint-initdb.d never fired.
 *
 *   DATABASE_MIGRATOR_URL=postgresql://... node scripts/init-db.js
 *
 * Roles and extensions must already exist — run tools/00-bootstrap-dev.sql (or
 * tools/00-bootstrap-rds.sql in production) as a superuser first. Both are
 * one-time, and both are documented in docs/PRODUCTION_DB_RUNBOOK.md.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

console.log(
  'init-db: delegating to scripts/migrate.js (baseline -> config -> migrations).\n'
  + '         If roles or extensions are missing, apply src/db/tools/00-bootstrap-dev.sql\n'
  + '         as a superuser first.\n');

const result = spawnSync(
  process.execPath,
  [path.join(__dirname, 'migrate.js'), ...process.argv.slice(2)],
  { stdio: 'inherit' },
);

process.exit(result.status === null ? 1 : result.status);
