/**
 * Just the dotenv side-effect, split out of config/env.js so a module that
 * only needs an env var like DATABASE_URL populated (config/db.js) doesn't
 * also pull in config/env.js's OTHER required() checks (ADMIN_SECRET_PATH,
 * ENCRYPTION_KEY) — those are unrelated to database connectivity, and a test
 * that deliberately simulates an unconfigured environment (rate-limiter.
 * test.js's "unset NODE_ENV behaves like production" case) legitimately
 * never sets them. Safe to require from multiple places — Node caches this
 * module, so the dotenv call itself only ever runs once per process.
 */
require('dotenv').config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });
