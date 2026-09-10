# PanditSuggest — Final Pre-Production Database Architecture Audit

**Date:** 2026-09-06
**Type:** Evidence collection only. No fixes implemented, no production data modified.
**Production access:** READ-ONLY throughout.
**Destructive experiments:** performed exclusively on a disposable scratch database (`audit_scratch_fresh`), created and dropped inside this session. Production row count was 637 users before and 637 after.

**Verification legend**

| Tag | Meaning |
|---|---|
| **PROVEN** | Reproduced by execution during this audit |
| **VERIFIED** | Confirmed by direct inspection of live catalog or source |
| **NOT VERIFIED** | Could not be established safely — stated as unknown, not guessed |

---

## 0. Headline

The migration set is well-engineered. When the single bootstrap defect is corrected, **all 36 files apply cleanly, in order, on a genuinely empty database** — PROVEN this session. And **33 of the 34 incremental migrations are truly idempotent** on a second pass — also PROVEN. That is a much stronger starting position than the prior audit implied.

Against that, six findings are P0. Three are new to this audit and none of them are in the SQL:

| ID | Finding | Severity |
|---|---|---|
| **P0-1** | No database backup of any kind exists. Single Docker volume, single EC2, 93 %-full disk | P0 |
| **P0-2** | `01-schema.sql` cannot build a fresh database; leaves it half-built with **0 RLS policies and 0 grants** | P0 |
| **P0-3** | Nine `npm run test:*` scripts do not set `NODE_ENV=test`, which disables `testDbGuard` entirely; the fallback connection string is production-as-superuser | P0 |
| **P0-4** | Anonymous app-role connection can read **100 % of `users`**, including `password_hash` of the admin account | P0 |
| **P0-5** | `npm run db:migrate` aborts at migration 25; migrations 26–36 unreachable | P1→P0 for deployment |
| **P0-6** | Production DB is 99 % non-real data (633 of 637 users); it is not a viable migration source | P0 |

**P0-3 is the most urgent.** It is the live, still-open mechanism that produced P0-6, and it can fire again today from a single command.

---

## 1. Current DB architecture

```
                    AWS account 376834080419 · ap-south-1 (Mumbai)
  ┌───────────────────────────────────────────────────────────────────────┐
  │  EC2 i-0758b2af28b1a3434  ·  t3.medium  ·  8 GB root disk (93 % full) │
  │  IAM: PanditSuggestEC2MediaRole  (S3 media only — no RDS permissions) │
  │                                                                       │
  │   panditconnect-frontend ──┐                                          │
  │                            │  docker network                          │
  │   panditconnect-backend ───┼──► panditconnect-db                      │
  │     node-pg Pool           │      PostgreSQL 16.15                    │
  │     max=10 (pg default)    │      PostGIS 3.4.3 · pgvector 0.8.6      │
  │     no statement_timeout   │      ssl = OFF                           │
  │     no ssl · no app_name   │      statement_timeout = 0               │
  │                            │      max_connections = 100               │
  │                            │                                          │
  │                            └──► volume all-india-pandit_db_data       │
  │                                 /var/lib/docker/volumes/...           │
  │                                 ** NO BACKUP · NO SNAPSHOT · NO PITR **│
  └───────────────────────────────────────────────────────────────────────┘
```

VERIFIED: region, instance type, IAM role, account id via IMDSv2 + `sts get-caller-identity`.
NOT VERIFIED: whether any RDS instance exists in the account — `rds:DescribeDBInstances` is denied to the EC2 role. The role having no RDS permission at all is strong circumstantial evidence that RDS is not currently in use, but this is **not proven**.

**Database roles — VERIFIED (only two exist):**

| Role | SUPERUSER | BYPASSRLS | LOGIN | Purpose |
|---|---|---|---|---|
| `panditconnect` | **yes** | **yes** | yes | Schema owner, migration runner, test super-pool |
| `panditconnect_app` | no | no | yes | Runtime app role |

No migration-only role. No read-only/monitoring role. `relforcerowsecurity` is **false on every table** (VERIFIED), so the owner bypasses RLS completely — correct for migrations, but it means any accidental runtime connection as `panditconnect` silently disables the entire security model.

---

## 2. Application → DB dependency map

Extracted from 57 DB-touching source files (VERIFIED by static analysis of SQL literals). Criticality is my assessment.

| Component | Reads | Writes | DB functions | Txn? | Sensitive | Crit |
|---|---|---|---|---|---|---|
| `qualifiedLeads.repository` | qualified_leads, contact_clicks, pandit_analytics, pandits, users | qualified_leads, contact_clicks, pandit_analytics | `record_qualified_lead`, `increment_pandit_stats` | **YES** (explicit BEGIN/COMMIT) | phone, name | **Critical** |
| `payments.repository` | payment_transactions, pandit_subscriptions, subscription_plans, pandits | payment_transactions, pandit_subscriptions, webhook_events | `activate_pandit_subscription`, `seat_usage`, `calculate_pandit_rank` | Partial — see §11 | payment refs | **Critical** |
| `distribution.repository` | distribution_config, plan_market_entitlements, pandit_exposure, qualified_leads, pandits, pandit_services, pandit_temples, users | pandit_exposure | — | no | — | **Critical** |
| `auth.repository` | users, user_sessions, otp_verifications, reviews, community_* , saved_* | users, user_sessions, otp_verifications, pandits | `auth_find_user_by_email`, `auth_find_user_by_phone` | partial | **hashes, OTP** | **Critical** |
| `passwordReset.repository` | — | — | `auth_find_pandit_for_reset`, `auth_create_reset_challenge`, `auth_consume_reset_challenge` | in-function | **reset tokens** | **Critical** |
| `admin/auth.repository` | users, admin_sessions | users, admin_sessions, admin_mfa_challenges | `admin_find_challenge_with_user`, `auth_find_user_by_email` | partial | **TOTP, sessions** | **Critical** |
| `admin/pandits.repository` | pandits, users, pandit_*, plan_market_entitlements, qualified_leads | pandits, users, pandit_*, user_sessions, notifications | `activate_pandit_subscription`, `calculate_pandit_rank` | partial | PII | High |
| `admin/subscriptions.repository` | pandit_subscriptions, payment_transactions, subscription_plans | pandit_subscriptions, payment_transactions, subscription_plans | `activate_pandit_subscription` | partial | payment | High |
| `ai.repository` | ai_conversations, ai_messages | ai_conversations, ai_messages, ai_feedback, ai_query_analytics, ai_recommendation_events | `record_qualified_lead` | `withAiContext` | **AI query text** | High |
| `pandits.repository` | pandits, users, pandit_*, services, temples | contact_clicks, inquiries, pandit_analytics | `increment_pandit_stats` | no | phone | High |
| `distributionAdmin.repository` | distribution_config(+audit), plan_market_entitlements | via functions only | `set_distribution_config`, `set_plan_entitlement` | in-function | — | High |
| `billing/expiryScheduler` | — | pandits (via fn) | `revert_expired_pandit_tiers` | in-function | — | High |
| `billing/reminderScheduler` | pandit_subscriptions, pandits, users, subscription_plans, subscription_reminder_log | notifications, subscription_reminder_log | — | no | — | Medium |
| `ai/retrieval + ranking + matching` | ai_knowledge_chunks/documents, ai_ranking_config, pandits, pandit_services, qualified_leads, reviews | — | — | no | — | High |
| `utils/activityLog` | — | user_activity_events | — | no (best-effort) | coarse geo | Medium |
| `utils/securityLog`, `adminLog` | — | security_audit_log, admin_activity_log | — | no | IP, UA | Medium |
| `middleware/ipBan`, `honeypot` | banned_ips | honeypot_logs | — | no | IP | Medium |
| `sitemap`, `services`, `temples`, `faqs`, `siteImages`, `homeHero`, `misc`, `social`, `community`, `reviews`, `contact` | public content tables | content tables, inquiries, newsletter_subscribers, contact_messages | — | no | email (contact) | Medium/Low |

**Schedulers start on every backend instance** (`server.js:17,21` — VERIFIED). With N instances, N copies of `expiryScheduler` and `reminderScheduler` run. `revert_expired_pandit_tiers()` is safe (its WHERE clause is self-limiting) and reminders are protected by `subscription_reminder_log`'s unique constraint — but neither is leader-elected. P2 for multi-instance.

**The app does NOT run migrations at startup** (VERIFIED) — good; it removes one deploy-race vector.

---

## 3. Schema object inventory (VERIFIED, live catalog)

| Object | Count |
|---|---|
| Extensions | 7 — `plpgsql`, `pgcrypto` 1.3, `postgis` 3.4.3, `pg_trgm` 1.6, `btree_gin` 1.3, `unaccent` 1.1, `vector` **0.8.6** |
| Enums | 18 |
| Tables | 70 (incl. PostGIS `spatial_ref_sys`) |
| Views | 5 (3 app + 2 PostGIS) · Materialized views: **0** |
| Indexes | 272 |
| Triggers (non-internal) | 17 |
| RLS policies | 57 across 15 tables |
| Functions in `public` | 1,077 (1,063 are PostGIS) |
| `SECURITY DEFINER` functions | **14** |
| Sequences | 3 (BIGSERIAL on the three append-only logs) |

**RLS coverage — VERIFIED.** Enabled on 15 of 70 tables:
`users, pandits, inquiries, notifications, pandit_analytics, payment_transactions, qualified_leads, password_reset_challenges, ai_conversations, ai_messages, ai_feedback, ai_recommendation_events, home_hero_images, universal_faqs, site_images`.

**Not RLS-protected but holding sensitive data** — `user_sessions`, `otp_verifications`, `admin_sessions`, `admin_mfa_challenges`, `ai_query_analytics`, `contact_clicks`, `user_activity_events`, `visitor_geo_log`, `reviews`, `pandit_subscriptions`, `contact_messages`, `newsletter_subscribers`, `security_audit_log`.

**Largest tables:** `spatial_ref_sys` 7.1 MB · `pandit_exposure` 984 kB · `pandits` 704 kB · `users` 648 kB · `user_activity_events` 600 kB · `security_audit_log` 536 kB. Total database is trivially small — this is a **greenfield-scale** dataset.

Many tables report `reltuples = -1` (never analyzed) — autovacuum is on but has had little to do. Not a problem yet; it is a monitoring gap.

---

## 4. Schema dependency order & fresh-build proof (Phase 3)

### PROVEN: the current `01-schema.sql` cannot build a fresh database

Executed against an empty scratch database:

```
$ psql -d audit_scratch_fresh -v ON_ERROR_STOP=1 -f 01-schema.sql
ERROR:  relation "contact_clicks" does not exist
LINE 9:       FROM contact_clicks c WHERE c.created_at >= p_since GR...
exit 3
```

Cause: `get_pandit_lead_counts()` is defined at line **807**; its body reads `contact_clicks`, created at line **838**. PostgreSQL 16 with `check_function_bodies = on` (VERIFIED) resolves every relation in a `LANGUAGE sql` body at `CREATE` time.

### PROVEN: the blast radius is a half-built, unsecured database

psql runs statements in autocommit, so **nothing rolls back**. State of the scratch DB after the abort:

| Measure | Result |
|---|---|
| Tables created | **22** |
| Views created | 2 (both PostGIS) |
| **RLS policies created** | **0** |
| **Tables with RLS enabled** | **0** |
| **Grants to `panditconnect_app`** | **0** |

A fresh `docker compose down -v && up` therefore yields a database that is **simultaneously incomplete and completely unsecured**, and the application cannot even connect to it (no grants). Because the postgres entrypoint uses `ON_ERROR_STOP=1`, files `02`–`36` never run.

`scripts/init-db.js` behaves differently — it sends the file as one `client.query()`, so the whole file rolls back and you get an empty database instead. Both outcomes are broken; only one is silent.

### PROVEN: a one-block reorder fixes it completely

Moving the `get_pandit_lead_counts()` definition (lines 807–819) to immediately after `CREATE TABLE contact_clicks` — tested as a scratchpad copy, **the repository was not modified** — produced:

```
01-fixed.sql  → exit 0
```

Then applying `02` … `36` in filename order, one file at a time:

```
  ok  02-seed.sql        ok  13 ... 24
  ok  03-qualified-leads  ok  25-universal-faqs.sql
  ok  04 ... 12           ok  26 ... 36
```

**All 35 remaining files applied cleanly. Zero failures.**

**Conclusion (high confidence):** there is exactly **one** ordering defect in the entire 7,112-line schema. The dependency graph is otherwise topologically valid as written. This materially de-risks the baseline decision in §7.

---

## 5. Historical migration matrix (Phase 4)

Classification from full reading; re-run safety is **PROVEN** by a second full pass over the scratch DB.

| # | File | Class | Empty DB | Populated DB | Re-run | Txn-safe | Rewrites/alters real data |
|---|---|---|---|---|---|---|---|
| 01 | schema | SCHEMA+ROLE+RLS+GRANT | **FAILS** | destructive (`DROP SCHEMA CASCADE`) | destructive | file-level | **Yes — drops everything** |
| 02 | seed | SEED | ok | **fails** (0 `ON CONFLICT` in 619 inserts) | **no** | no | inserts demo rows |
| 03 | qualified-leads | SCHEMA+FUNCTION+RLS+GRANT | ok | ok | ok | mixed | no |
| 04 | dynamic-content | SCHEMA+INDEX+RLS+GRANT | ok | ok | ok | mixed | normalises NULL `samagri_list` |
| 05 | temple-content | SCHEMA | ok | ok | ok | yes | no |
| 06 | service-categories | SCHEMA+INDEX | ok | ok | ok | yes | no |
| 07 | online-puja | SCHEMA+INDEX | ok | ok | ok | yes | no |
| 08 | pandit-credentials | SCHEMA | ok | ok | ok | yes | no |
| 09 | platform-reviews | SCHEMA+ENUM+INDEX | ok | ok | ok | enum caveat | relaxes NOT NULL |
| 10 | temple-media-placement | SCHEMA+INDEX+**REPAIR** | ok | ok | ok | mixed | **demotes extra covers** |
| 11 | temple-services | SCHEMA+CHECK+GRANT | ok | ok | ok | mixed | no |
| 12 | ai-foundation | SCHEMA+EXT+RLS+SEED+CONFIG | ok | ok | ok | mixed | **re-creates insecure guest policy** |
| 13 | ai-guest-rls-fix | **SECURITY** | ok | ok | ok | mixed | no |
| 14 | profile-photo-repair | **ONE-TIME REPAIR** | ok (no-op) | ok | ok* | mixed | **rewrites `profile_photo_url`** |
| 15 | lead-distribution-v2 | SCHEMA+SEED+GRANT | ok | ok | ok | mixed | **backfills `market`** |
| 16 | market-attribution | FUNCTION+BACKFILL | ok | ok | ok | mixed | **backfills `market`** |
| 17 | grants-least-privilege | GRANT | ok | ok | ok | yes | no |
| 18 | admin-controls | SCHEMA+CONFIG+FUNCTION | ok | ok | ok | mixed | resets config bounds |
| 19 | seat-cap | FUNCTION+TRIGGER | ok | ok | ok | mixed | no |
| 20 | fix-lead-lock | **BUGFIX FUNCTION** | ok | ok | ok | yes | no |
| 21 | analytics-upsert-rls | **RLS (widening)** | ok | ok | ok | yes | no |
| 22 | user-activity-events | SCHEMA+ENUM+**UNGUARDED GRANT** | ok | ok | ok | **no txn** | no |
| 23 | otp-phone-login | FUNCTION | ok | ok | ok | yes | no |
| 24 | drop-panchang | **DESTRUCTIVE DDL** | ok | ok | ok | yes | **DROPs 3 tables** |
| 25 | universal-faqs | SCHEMA+RENAME+RLS | ok | ok | **FAILS** | mixed | renames `faqs` |
| 26 | media-storage-keys | SCHEMA | ok | ok | ok | yes | no |
| 27 | city-snapshot | SCHEMA+FUNCTION+BACKFILL | ok | ok | ok | mixed | backfills snapshots |
| 28 | billing-hardening | SCHEMA+GRANT | ok | ok | ok | mixed | no |
| 29 | tier-system-writes | **SECURITY DEFINER FN** | ok | ok | ok | mixed | no |
| 30 | refund-tracking | SCHEMA | ok | ok | ok | yes | no |
| 31 | subscription-reminders | SCHEMA+GRANT | ok | ok | ok | mixed | no |
| 32 | pandit-pause | SCHEMA+FUNCTION | ok | ok | ok | mixed | no |
| 33 | nullable-email | SCHEMA+**BACKFILL** | ok | ok | ok | **no txn** | **promotes user status** |
| 34 | temple-cover-webp | **CONTENT MIGRATION** | ok | ok | ok | yes | **rewrites URLs** |
| 35 | blended-mode | CONFIG | ok | ok | ok | yes | no |
| 36 | site-images | SCHEMA+RLS+GRANT | ok | ok | ok | mixed | no |

\* 14 re-runs without error today, but re-asserts a permanent invariant — see P2-14.

**Second-pass result — PROVEN:** 33 of 34 re-ran cleanly. The sole failure:

```
FAIL(3) 25-universal-faqs.sql :: ERROR:  relation "faqs" does not exist
```

Because `scripts/migrate.js` calls `process.exit(1)` on the first failure, **migrations 26–36 are unreachable** on any database where 25 has already applied — i.e. every real one.

**Second, production-specific break in 25:** its self-check requires `>= 8` published GLOBAL FAQs. Production has **1** (VERIFIED — `universal_faqs` holds 4 rows total: one each GLOBAL/HOME/SERVICE/PANDIT). This did *not* fire on the scratch DB, because `02-seed.sql` supplies 8. So migration 25 has two independent failure modes and the second only manifests against real data.

---

## 6. Migration runner behaviour (Phase 5) — VERIFIED by source

`scripts/migrate.js`:

| Property | Current state |
|---|---|
| Discovery | `readdirSync` + regex `^\d+.*\.sql$`, excludes `01-`/`02-` |
| Ordering | JS string `.sort()` — works for 03–36; **breaks at 100+** (`"100" < "99"`) |
| Ledger | **none** |
| Checksum | **none** |
| Advisory lock | **none** |
| Transaction | one `client.query(wholeFile)` → implicit txn, but files with mid-file `COMMIT` split it |
| Error handling | log + `process.exit(1)` on first failure |
| Retry | none |
| `statement_timeout` / `lock_timeout` | **not set** (server defaults are `0` = unlimited — VERIFIED) |
| Identity verification | none — trusts `DATABASE_OWNER_URL` ‖ `DATABASE_URL` ‖ **hardcoded production fallback** |
| Logging | stdout only; surfaces `RAISE NOTICE` (good) |

### Scenario answers

| Scenario | Current behaviour |
|---|---|
| **Two instances deploy simultaneously** | Both run all migrations concurrently. No lock. Idempotent DDL mostly survives, but 10/14/16/27/33/34's data-mutating statements interleave, and `CREATE OR REPLACE FUNCTION` races are last-writer-wins. **Unsafe.** |
| **Migration succeeds but ledger write fails** | N/A — there is no ledger. Every migration re-runs every time by design. |
| **Migration crashes midway** | Files with mid-file `COMMIT` (20 of 34) keep the committed half. Runner exits 1; next run re-executes the whole file from the top. Self-checks catch most, not all. |
| **App starts before migration completes** | Possible — nothing coordinates them. App would 500 on missing columns; no fail-fast. |
| **Migration file edited after production applied it** | **Silently re-applied with the new content.** No checksum. This is how undetected drift enters. |

---

## 7. Schema drift report (Phase 23) — PROVEN

Canonical schema built from `01-fixed` + `02`–`36` on the scratch DB, diffed against production across columns, indexes, policies and grants.

| Dimension | Scratch | Production | Drift |
|---|---|---|---|
| Columns | 904 | 905 | **+1 in prod** |
| Indexes | 271 | 272 | **+1 in prod** |
| RLS policies | 57 | 57 | **none** |
| App-role grants | 276 | 276 | **none** |

The entire drift is:

```
home_hero_images.gallery  VARCHAR NOT NULL DEFAULT 'home'
CREATE INDEX idx_home_hero_gallery ON home_hero_images (gallery, display_order)
```

Defined by **no migration** (VERIFIED) and referenced by **no application code** (VERIFIED — the only `gallery` matches in `src/` are unrelated prose comments). It is orphan drift from a manual `psql` session.

**Assessment.** The drift itself is harmless. What it demonstrates is not: manual schema changes reach production, are never captured in source, and are detected by nobody. Rebuilding production from migrations today would silently drop this column. That RLS policies and grants show *zero* drift is genuinely reassuring about the security model.

---

## 8. Baseline recommendation (Phase 7)

| Option | Reproducible | Readable | DR-suitable | Drift risk | Verdict |
|---|---|---|---|---|---|
| **A** — replay fixed 01–36 on new prod | **PROVEN this session** | high (36 annotated files) | slow but works | low | Viable |
| **B** — schema-only `pg_dump` of reviewed scratch | exact | poor (machine output, loses all the "why") | fastest | lowest | Rejected alone |
| **C** — hand-curated baseline SQL | manual | high | good | **high** (hand transcription of 7,112 lines) | Rejected |
| **D** — **A once, then freeze as baseline + config seed** | **PROVEN** | high | fast | low | **Recommended** |

### Recommended: option D

Concretely:

1. Apply the corrected `01`–`36` to an empty database **excluding `02-seed.sql`** (it is demo content, not production configuration).
2. Verify that database against the acceptance gates in §20.
3. `pg_dump --schema-only --no-owner --no-privileges` it → **`000-baseline-schema.sql`**, committed and never edited again.
4. Author a small, reviewed **`001-production-config-seed.sql`** containing only the rows a production system genuinely requires at T=0 (see §9).
5. Archive `01`–`36` under `db/historical/`, excluded from the runner, kept for provenance.
6. All future work starts at `002-…`, under the exactly-once runner in §10.

**Why D over A.** Option A is proven to work, but it replays 20 files containing data-mutating statements (backfills, repairs, content rewrites) against a database that has no data to mutate. Those statements are pure risk on a fresh install and are exactly the ones that misbehave on re-run (P2-12/13/14). D preserves A's proven-correct *output* while removing the historical baggage from every future bootstrap. It also makes CI's fresh-install path fast enough to run on every PR.

**Why keep `02-seed.sql` out of production.** VERIFIED: it contains 23 users sharing one committed bcrypt hash, including `admin@panditconnect.demo` with `role='admin'`, `status='active'`. That row must never exist in production.

---

## 9. Data classification & the T=0 production database (Phase 8)

| Class | Tables | Rows at T=0 |
|---|---|---|
| **SYSTEM CONFIG** — must be present | `distribution_config` (14 keys), `plan_market_entitlements` (4 rows), `ai_ranking_config` (15 keys), `subscription_plans` | seeded, reviewed |
| **REFERENCE DATA** — business catalogue | `service_categories`, `services`, `service_samagri`, `taxonomy`, `stats`, `recommend_rules`, `ai_problem_categories`, `ai_problem_service_mappings` | curated, **not** from `02-seed` |
| **REAL USER DATA** | `users`, `pandits`, `pandit_*` | **0**, except one genuine super_admin |
| **REAL BUSINESS DATA** | `qualified_leads`, `payment_transactions`, `pandit_subscriptions`, `inquiries`, `reviews`, `contact_clicks` | **0** |
| **TEST FIXTURE** | — | **0**, permanently |
| **DEMO** | `02-seed.sql` content, `seed-nalkheda-500` output | **0**, permanently |
| **TEMPORARY** | `otp_verifications`, `password_reset_challenges`, `admin_mfa_challenges`, `user_sessions`, `admin_sessions` | 0 |
| **AUDIT** | `security_audit_log`, `admin_activity_log`, `honeypot_logs`, `distribution_config_audit`, `webhook_events` | 0 |
| **ANALYTICS** | `pandit_analytics`, `platform_analytics`, `user_activity_events`, `ai_query_analytics`, `pandit_exposure`, `visitor_geo_log` | **0** |
| **DERIVED** | `pandits.rank_score/avg_rating/review_count`, `temples.pandit_count`, `ai_knowledge_chunks.*` denorm | computed |

**Note on `ai_query_analytics`:** migration 12 seeds 13 synthetic `seeded_from_knowledge_base` demand-gap rows. VERIFIED: production holds 20 rows, 13 of them synthetic. These are fabricated analytics and should be excluded from the T=0 baseline, or at minimum filtered out of every report that reads the table.

### Current production content — VERIFIED by email domain

| Domain | Users | Source |
|---|---|---|
| `test.local` | **564** | `tests/helpers.js` and test factories |
| `panditsuggest.test` | **60** | `scripts/seed-nalkheda-500.js` (partial run of 500) |
| `example.com` | 4 | test/demo |
| `panditconnect.demo` | 3 | `02-seed.sql` + `admin-test-*` fixtures |
| `gmail.com` | **4** | plausibly real — includes the genuine `super_admin` |

**633 of 637 users (99.4 %) are non-real.** All 24 `role='admin'` accounts are test fixtures. 118 qualified leads, 44 payment transactions and 2,265 exposure rows are correspondingly synthetic.

**Conclusion:** production contains no business data worth migrating. NOT VERIFIED: whether the 4 `gmail.com` accounts represent real people — **this needs a human decision before cutover** (§21).

---

## 10. Exactly-once migration model (Phase 6)

Required ledger:

```sql
CREATE TABLE schema_migrations (
  version       TEXT PRIMARY KEY,       -- '0042'; zero-padded, sorts correctly past 99
  filename      TEXT NOT NULL,
  checksum      TEXT NOT NULL,          -- sha256 of file bytes
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_ms  INTEGER NOT NULL,
  applied_by    TEXT NOT NULL,          -- db role + host
  deployment_id TEXT                    -- CI run / release tag
);
```

**Ordering:** zero-padded numeric (`0001`…`9999`). Timestamps invite merge-order surprises; UUIDs have no order. The current `.sort()` already breaks at 100 files.

**Invariants and how each is met**

| Invariant | Mechanism |
|---|---|
| Applied migration never re-executes | `WHERE version NOT IN (SELECT version FROM schema_migrations)` |
| Edited applied migration fails loudly | recompute sha256, compare to stored, **abort the whole run** |
| Concurrent migrators impossible | `pg_advisory_lock(<constant>)` held for the entire run; second migrator blocks or exits |
| Deterministic order | zero-padded version, lexical sort |
| Failed migration not recorded | insert the ledger row **inside** the same transaction as the migration |
| Migration + ledger atomic | wrap each file in one explicit transaction — **requires removing mid-file `COMMIT`s** |

**Blocker for full atomicity:** 20 of 34 current files contain a mid-file `COMMIT`, and `ALTER TYPE … ADD VALUE` (migration 09) plus `CREATE INDEX CONCURRENTLY` (future) cannot run inside a transaction block. The runner therefore needs a per-file `-- migrate:no-transaction` opt-out, and those files must be individually re-runnable. Baseline option D removes this problem for everything historical.

**Also required:** `SET lock_timeout = '5s'` and `SET statement_timeout = '5min'` at the top of every migration session, so a migration blocks on a lock for seconds rather than taking the site down.

---

## 11. Payment / subscription integrity (Phase 12)

### Trace

`subscribe()` → seat check → Razorpay order → `payment_transactions(pending)` + `pandit_subscriptions(is_active=false)` → webhook → HMAC verify → `recordWebhookEvent` (dedupe) → `activateSubscription` → `markWebhookEventStatus`.

### What is correct

- **HMAC signature verified before any DB write** (VERIFIED).
- `webhook_events (provider, dedupe_key)` UNIQUE, with the `xmax = 0` trick to distinguish insert from conflict — a genuinely good idempotency primitive.
- `activateSubscription`'s four statements run inside one `withSetting` transaction (BEGIN/COMMIT on a single client) — atomic.
- **Re-activation is naturally idempotent**: `expires_at` is read from the existing `pandit_subscriptions` row, fixed at order creation, **not** computed additively from the current expiry. A duplicate webhook therefore writes the *same* expiry. **This is the single most important thing that is right here** — it means the crash window below is not an entitlement-corruption bug.
- Migration 29's diagnosis is correct: a webhook satisfies neither `pandits_update_self` nor `pandits_update_admin`, so the SECURITY DEFINER route is genuinely necessary.

### Gaps

**P1-A — `activate_pandit_subscription()` performs zero validation.** VERIFIED source:

```sql
CREATE OR REPLACE FUNCTION activate_pandit_subscription(p_pandit_id UUID, p_tier subscription_tier, p_expires_at TIMESTAMPTZ)
RETURNS VOID AS $$ BEGIN
    PERFORM set_config('app.allow_seat_overflow', 'on', true);
    UPDATE pandits SET current_tier = p_tier, subscription_expires_at = p_expires_at, is_paused = FALSE, ...
```

`SECURITY DEFINER`, granted to `panditconnect_app`, no check that a captured payment exists, no check that the tier matches what was paid for, no bound on expiry, and it unconditionally disables the seat cap. Any code path or injection reaching it grants unlimited free `diamond` tiers. Contrast `record_qualified_lead()`, which re-validates every invariant internally — the right pattern, already established in this codebase.

**P1-B — missing uniqueness on payments.** VERIFIED: `payment_transactions` has exactly one UNIQUE constraint, on `invoice_number`. There is **no** unique constraint on `gateway_payment_id` or `gateway_order_id`. DB-level duplicate payment rows are possible; only the application's `webhook_events` gate prevents them.

**P1-C — no "one active subscription per pandit" constraint.** VERIFIED: `pandit_subscriptions` has only a PK. Nothing structurally prevents two rows with `is_active = TRUE` for the same pandit. Today `activateSubscription` deactivates siblings in the same transaction — correct, but it is application-enforced only.

**P2-D — webhook status marking is outside the activation transaction.** Three separate transactions: dedupe → activate → mark processed. A crash between 2 and 3 leaves `processing_status = 'received'`; `alreadyProcessed` is `!inserted && processing_status === 'processed'` (VERIFIED), so Razorpay's retry **re-runs activation**. Harmless in effect (idempotent expiry, per above) but it re-deactivates and re-activates rows and leaves the audit trail wrong.

### Invariants that should be enforced structurally

```
UNIQUE (gateway_payment_id) WHERE gateway_payment_id IS NOT NULL
UNIQUE (gateway_order_id)   WHERE gateway_order_id   IS NOT NULL
UNIQUE (pandit_id)          WHERE is_active                        -- pandit_subscriptions
CHECK  (refund_amount IS NULL OR refund_amount <= amount)
CHECK  (status <> 'completed' OR paid_at IS NOT NULL)
```

---

## 12. Lead distribution (Phase 11)

### Trace

click → auth → `recordContact()` **[explicit BEGIN/COMMIT — VERIFIED]** → `record_qualified_lead()` → method gate → user active + `phone_verified` → pandit exists, not self → `pg_advisory_xact_lock(hashtextextended(pandit:user, 42))` → rolling-window dedup → market from `country_from_phone(users.phone)` → INSERT → `contact_clicks` + `increment_pandit_stats` + `pandit_analytics` upsert → COMMIT.

### What is correct

- Advisory lock scoped to the exact `(pandit, user)` pair, released at COMMIT — correct concurrency design, correctly fixed by migration 20.
- **No INSERT policy on `qualified_leads`** and `DELETE` revoked from the app role (VERIFIED) — the SECURITY DEFINER function is genuinely the only write path, and leads cannot be erased.
- Market derived from the *verified* phone inside the function, never from a caller parameter or IP — deliberate and right; `ADMIN_OVERRIDE` honestly marks the fallback.
- Snapshot columns (name/phone/city/state) mean a pandit's paid lead survives profile edits and account deletion.

### Why migration 03 keeps causing upgrade trouble

Separating the two, as asked:

**Migration problem (the real one).** `record_qualified_lead()` is redefined **four times** — 03 (5 args), 16 (7 args, drops the 5-arg), 20 (lock fix), 27 (city snapshot). Each redefinition restates the *entire* function body. Any migration that re-bases on an older copy silently reverts later fixes; migration 27's header records that it "almost shipped" exactly that regression. Combined with a runner that re-executes every file on every run and has no checksum, the effective definition depends on **file ordering, not intent**. That is the whole problem, and it is a migration-system problem, not a logic problem.

**Runtime logic problem.** Essentially none. The current body is correct. The one historical runtime bug — `pg_advisory_xact_lock(bigint, bigint)`, an overload that has never existed — was real, total (every qualifying lead raised 42883), and is fixed.

**Recommendation:** do not touch the logic. Collapse the four definitions into one canonical function in the baseline, and let the exactly-once ledger guarantee it is never silently re-based again.

### Gaps

- **P2** `seat_usage()` (migration 19) counts with no lock — two concurrent sales can both pass a full cap. `record_qualified_lead()` solves the identical race properly; the same advisory-lock pattern belongs here.
- **P3** Migration 19's header says downgrades are not blocked. The code blocks arrival at **any** capped tier, so `gold → silver` into a full silver tier *is* blocked. Comment is misleading.
- **P3** Tier `free` has no `plan_market_entitlements` rows, so free pandits are structurally excluded from distribution. Fails closed, probably intended, undocumented.

---

## 13. Authentication & sensitive data (Phases 13–14)

### PROVEN: anonymous app-role connection reads the entire `users` table

Connected to the scratch DB as `panditconnect_app` with **no identity GUC set** — the exact state of an unauthenticated request:

```
role      | rows | password_hash visible | email visible
----------+------+-----------------------+---------------
devotee   |    6 |                     6 |             6
pandit    |   16 |                    16 |            16
admin     |    1 |                     1 |             1
```

Every row. Including the **admin account's password hash**.

Three permissive policies union together to produce this:
- `users_select_public` → all `pandit` / `temple_admin` rows
- `users_select_via_public_content` → any user who authored a published review, post, comment **or blog post** — which is how the admin row becomes readable, since `02-seed.sql` makes the admin the author of 9 published blog posts
- RLS is **row**-level: once a row is visible, every column is, including `password_hash`, `totp_secret_encrypted`, `google_id`, `facebook_id`, `date_of_birth`, `phone`

Today the only thing preventing disclosure is that application queries happen to name their columns. One `SELECT *`, one ORM change, or one SQL injection converts this into full credential disclosure. **P0-4.**

### Other authentication findings

| Item | State |
|---|---|
| Password hashes | bcrypt. **VERIFIED:** all 23 seeded users share one committed hash, incl. an active admin — P1 |
| `password_reset_challenges.attempts` | **VERIFIED never incremented anywhere** in `src/**` or `db/*.sql`. The `attempts < max_attempts` guard in `auth_consume_reset_challenge` is dead code — P1 |
| Reset tokens | sha256-hashed at rest, single-use enforced inside the UPDATE predicate — correct |
| OTP | `otp_verifications` hashed; attempts **are** incremented (`auth.repository.js:181`); **no RLS** on the table |
| TOTP | AES-256-GCM at rest via `ENCRYPTION_KEY`; key currently in a plaintext `.env` — P1 for AWS |
| Sessions | opaque bearer + sha256, separate `user_sessions` / `admin_sessions` — good design; **neither has RLS** |
| Expiry cleanup | **No scheduled purge found** for expired sessions, OTPs, or challenges — P2 |
| `security_audit_log` | append-only enforced by grant (VERIFIED) — good |

### Sensitive data map

| Table.Column | Sensitivity | Should read | Should write | Public? | Encrypt? | Retention |
|---|---|---|---|---|---|---|
| `users.password_hash` | **Critical** | auth fn only | auth fn only | **currently YES — bug** | hashed | life of account |
| `users.totp_secret_encrypted` | **Critical** | admin auth fn | admin auth fn | currently yes (row) | **AES-GCM ✓** | life of account |
| `users.phone` / `.email` / `.date_of_birth` | High | self, admin | self, admin | currently yes | at rest (RDS KMS) | life of account |
| `users.google_id` / `.facebook_id` | High | auth | auth | currently yes | at rest | life of account |
| `qualified_leads.contact_phone_snapshot` / `_name` / `_city` / `_state` | High | owning pandit, admin | fn only | no ✓ | at rest | business record |
| `ai_query_analytics.query_text` | **Critical** (mental-health content) | admin only | app | **no RLS — bug** | at rest | **should expire** |
| `ai_messages.content` | **Critical** | owner / session key | owner | no ✓ | at rest | user-controlled |
| `inquiries.phone` / `.email` / `.message` | High | pandit, admin | anyone (insert) | no ✓ | at rest | business record |
| `contact_messages.*`, `newsletter_subscribers.email` | Medium | admin | anyone | no RLS | at rest | until unsubscribe |
| `payment_transactions.gateway_*` | High | owner, admin, webhook | system | no ✓ | at rest | **accounting — do not auto-delete** |
| `user_sessions.token_hash`, `admin_sessions.token_hash` | High | auth | auth | no RLS | hashed | until expiry |
| `security_audit_log.ip_address` / `user_agent` | Medium | admin | append-only | no RLS | at rest | 1 yr suggested |
| `visitor_geo_log`, `user_activity_events` | Medium (coarse geo) | admin | app | no RLS | at rest | 90–180 d suggested |

**The sharpest inconsistency:** migration 13 correctly identifies AI conversations as the most sensitive rows in the database and locks `ai_conversations` / `ai_messages` to a per-session key. `ai_query_analytics` stores the same user sentences verbatim with **no RLS and full DELETE granted to the app role** (VERIFIED). **P1.**

---

## 14. SECURITY DEFINER audit (Phase 16)

**VERIFIED: all 14 functions have `proconfig = NULL` — not one pins `search_path`.**

| Function | PUBLIC revoked | Validates input | Authorizes caller | Notes |
|---|---|---|---|---|
| `activate_pandit_subscription` | ✓ | **none** | **none** | **P1** — grants any tier, disables seat cap |
| `revert_expired_pandit_tiers` | ✓ | n/a | n/a | WHERE baked in — safe |
| `record_qualified_lead` | ✓ | **full** | **full** | Exemplary |
| `get_pandit_lead_counts` | ✓ | n/a | aggregate only | Safe |
| `increment_pandit_stats` | ✓ | partial | none | Counter only — low risk |
| `auth_find_user_by_email` | ✓ | n/a | pre-auth by design | Returns `SETOF users` — full row incl. hash |
| `auth_find_user_by_phone` | ✓ | n/a | pre-auth by design | Same |
| `auth_find_pandit_for_reset` | ✓ | ✓ (role + status) | pre-auth by design | Returns id only — good |
| `auth_create_reset_challenge` | ✓ | partial | **none** | Caller could mint a challenge for any user id |
| `auth_consume_reset_challenge` | ✓ | ✓ | token is the credential | `attempts` guard dead (P1) |
| `admin_find_challenge_with_user` | ✓ | ✓ | token is the credential | Returns TOTP secret — correct but potent |
| `current_app_user_is_admin` | ✓ | n/a | n/a | Boolean only — safe |
| `set_distribution_config` | ✓ | **bounds enforced** | `p_admin_id` **not verified** | Audited; admin id is trusted, not checked |
| `set_plan_entitlement` | ✓ | ✓ | `p_admin_id` **not verified** | Same |

**Mitigating factor for the missing `search_path` (VERIFIED):** the `public` schema ACL is `panditconnect_app=U/panditconnect` — **USAGE only, no CREATE**. The app role cannot create shadowing objects, so the classic hijack is not currently exploitable. It remains a hardening gap that one careless `GRANT CREATE` would open. Every one of these should carry `SET search_path = public, pg_temp`.

---

## 15. Index & performance (Phase 17)

Dataset is tiny (largest app table under 1 MB), so nothing is slow today. Structural observations for scale:

- **49 FK columns have no supporting index** (VERIFIED). Most are low-cardinality attribution columns (`updated_by`, `uploaded_by`, `verified_by`) where the cost is paid on **cascading delete**: removing a user seq-scans every referencing table while holding locks. The ones that will matter first: `saved_pandits.pandit_id`, `saved_temples.temple_id`, `payment_transactions.subscription_id`, `contact_clicks.qualified_lead_id`, `pandit_exposure.user_id`, `user_activity_events.temple_id/service_id`.
- Hot paths are well covered: `idx_qleads_dedup`, `idx_qleads_pool`, `idx_exposure_pool`, `uq_exposure_session_hour`, `idx_ai_chunk_embedding` (HNSW, partial on `is_retrievable`), the trigram and tsvector GIN indexes.
- `idx_temple_services_temple` is created twice (01 and 11) — harmless, `IF NOT EXISTS`.
- No duplicate or clearly unused indexes found beyond that.
- **Not measured:** no `EXPLAIN` plans are meaningful at this row count. Re-run index analysis against realistic volume before optimising. **NOT VERIFIED** at scale.

---

## 16. Connection management (Phase 19)

`src/config/db.js:31` — VERIFIED:

```js
const pool = new Pool({ connectionString });
```

Every option is left at the node-pg default:

| Setting | Value | Risk |
|---|---|---|
| `max` | **10** (default) | 10 conns per instance |
| `idleTimeoutMillis` | 10 000 | ok |
| `connectionTimeoutMillis` | **0 = wait forever** | request hangs instead of failing fast — P2 |
| `statement_timeout` | **unset**; server = `0` | a runaway query runs forever — P1 |
| `lock_timeout` | **unset**; server = `0` | a migration can block the site indefinitely — P1 |
| `idle_in_transaction_session_timeout` | server = `0` | a leaked txn holds locks forever — P1 |
| `ssl` | **not configured** | server has `ssl = off` — **must change for RDS** — P1 |
| `application_name` | **unset** | cannot tell app from migration from script in `pg_stat_activity` — P2 |
| `keepAlive` | default off | NAT/idle drops on RDS — P2 |

**Worst-case connection budget** (`max_connections = 100`):

| Source | Conns |
|---|---|
| Backend × 1 instance | 10 |
| Backend × 4 instances | 40 |
| Deployment overlap (old + new) | 80 |
| Migration process | 1 |
| Schedulers (share the pool) | 0 |
| Admin scripts / psql | ~5 |
| **Peak during a rolling deploy of 4** | **~86 of 100** |

Tight but survivable at 4 instances; it fails at 5. **RDS Proxy is not needed yet** — revisit above ~6 instances or if Lambda is introduced. Setting `max` explicitly and adding `application_name` is worth doing regardless.

---

## 17. Transaction boundaries (Phase 20)

| Flow | Atomic today? | Assessment |
|---|---|---|
| Lead + click + stats + analytics | **YES** — explicit BEGIN/COMMIT/ROLLBACK on one client | Correct |
| `activateSubscription`'s 4 statements | **YES** — one `withSetting` transaction | Correct |
| Webhook dedupe → activate → mark processed | **NO** — three transactions | P2-D above |
| Admin mutation + `admin_activity_log` | **NO** — separate `query()` calls | P2: an action can succeed with no audit row, or vice versa |
| Signup + verification promotion | **NO** | P3 |
| `withSetting` / `withUserContext` / `withAiContext` | one client, BEGIN/COMMIT, ROLLBACK on error | Well built |

`withAiContext` deserves specific credit: it sets both GUCs on the **same** connection in the **same** transaction, and its comment explains precisely why nesting two `withSetting` calls would check out two clients and break the guest policy. That is the kind of reasoning that prevents outages.

---

## 18. AWS RDS compatibility (Phase 25)

Scanned all 36 files for superuser-only and RDS-hostile constructs. **Nothing genuinely blocking was found** — no `COPY … FROM PROGRAM`, no `dblink`, no `file_fdw`, no `ALTER SYSTEM`, no `CREATE TABLESPACE`, no `CREATE LANGUAGE`.

| Construct | Where | RDS verdict |
|---|---|---|
| `DROP SCHEMA IF EXISTS public CASCADE` | `01-schema.sql:12` | Works as `rds_superuser`, but on PG15+ `public` is owned by `pg_database_owner` and recreating it does not restore RDS's default ACLs. **Must be removed from the baseline** — a fresh RDS database needs no drop. **NOT VERIFIED on RDS.** |
| `CREATE ROLE panditconnect_app LOGIN PASSWORD '<literal>'` | `01-schema.sql:33,38` | Permitted for `rds_superuser`, **but the password is committed to git**. Must move to Secrets Manager and out of migrations entirely. |
| `CREATE EXTENSION postgis` | `01-schema.sql:19` | Supported on RDS PG16 |
| `CREATE EXTENSION vector` | `12-ai-foundation.sql:44` | Supported, **but the live version is 0.8.6** and RDS ships a version pinned to the minor release. The HNSW index depends on it. **NOT VERIFIED** — must confirm the target RDS minor offers ≥ 0.8.x before cutover. |
| `pgcrypto`, `pg_trgm`, `btree_gin`, `unaccent` | `01-schema.sql` | All on the RDS supported list |
| `SECURITY DEFINER` × 14 | various | Fine — owner becomes the RDS master user rather than a true superuser; RLS bypass for the owner is unchanged |
| RLS | 15 tables | Fine. **Caveat:** on RDS the master user still owns the tables and `relforcerowsecurity = false`, so anything connecting as the master bypasses all RLS — same as today |

**The one thing that changes materially on RDS:** there is no true superuser. Nothing in this schema requires one, so migration is viable — but the role/ownership model must be redesigned deliberately rather than inherited (§19).

---

## 19. Recommended AWS topology & security

### RDS vs Aurora

| | Single-AZ RDS | **Multi-AZ RDS** | Aurora PG |
|---|---|---|---|
| Cost (ap-south-1, small) | lowest | ~2× | ~2–3× + I/O |
| Failover | manual, minutes–hours | automatic, 60–120 s | automatic, <30 s |
| PITR | ✓ | ✓ | ✓ (finer) |
| Ops complexity | low | low | medium |
| Fit for 0 real users → growth | under-protected | **right-sized** | over-engineered |

**Recommendation: RDS PostgreSQL 16, Multi-AZ, `db.t4g.small` or `db.t4g.medium`, `gp3` storage with autoscaling enabled.**

Rationale: the dataset is tiny and will stay tiny for a long time (§20 growth), so Aurora's throughput and storage architecture buy nothing that justifies the cost or the extra operational surface. What this project actually needs is *durability and a proven restore* — which Multi-AZ RDS plus automated backups delivers at a fraction of Aurora's cost. Aurora becomes worth revisiting at read-replica scale or multi-region.

Single-AZ is rejected: the current single-point-of-failure posture is precisely what this migration exists to end.

### Role model (replacing the current two-role setup)

| Role | Rights | Used by |
|---|---|---|
| `panditsuggest_owner` | owns schema + objects; **NOLOGIN** | nothing directly |
| `panditsuggest_migrator` | member of owner; LOGIN; credentials only in CI | migration job |
| `panditsuggest_app` | no ownership; table DML + function EXECUTE only | runtime |
| `panditsuggest_readonly` | `SELECT` + `pg_monitor` | dashboards, analysts, on-call |

Plus: `ALTER TABLE … FORCE ROW LEVEL SECURITY` on every RLS table, so even an accidental owner connection cannot bypass the policies.

### Network & secrets

- `PubliclyAccessible = false`; private subnets; SG allowing 5432 **only** from the backend SG.
- Admin access via SSM Session Manager port-forward — no bastion host, no public endpoint.
- `rds.force_ssl = 1`, and the client must set `ssl: { rejectUnauthorized: true, ca: <rds-ca-bundle> }`. Today `ssl = off` and the client requests none (VERIFIED) — this is a required change.
- **Secrets:** DB credentials, `ENCRYPTION_KEY`, Razorpay keys, `OPENAI_API_KEY`, `GOOGLE_SECRET_KEY`, `HYPERSENDER_API_KEY` and `ORIGIN_SHARED_SECRET` currently sit in a plaintext `/home/ec2-user/All-India-Pandit/.env` (VERIFIED — keys enumerated, **values never read or printed**). Move to Secrets Manager with RDS-managed rotation for the DB credential. The EC2 role (`PanditSuggestEC2MediaRole`) currently has S3 permissions only and will need `secretsmanager:GetSecretValue` scoped to those secrets.
- **Also required:** rotate `panditconnect_app`'s password. It is `panditconnect_app_dev`, committed in `01-schema.sql` and `docker-compose.yml`.
- Encryption at rest via KMS (CMK preferred) covering the instance, automated backups and every snapshot.

---

## 20. Growth, retention, backup, DR

### Growth model

Drivers, per active devotee-session and per pandit:

| Table | Rows per unit | 1 yr @ 1k MAU | 3 yr @ 10k MAU | Action |
|---|---|---|---|---|
| `pandit_exposure` | **~20 per listing view** | ~5–20 M | ~150 M+ | **Highest-growth table.** Retention + partitioning by month |
| `user_activity_events` | ~5–15 per session | ~2–8 M | ~60 M | Retention 90–180 d |
| `contact_clicks` | ~1 per CTA press | ~200 k | ~5 M | Retention or roll-up |
| `ai_messages` | ~6–20 per conversation | ~500 k | ~15 M | User-controlled retention |
| `ai_query_analytics` | 1 per query | ~300 k | ~8 M | **Expire `query_text` at 90 d** |
| `security_audit_log` | 1 per security event | ~1 M | ~10 M | 1 yr, then archive to S3 |
| `notifications` | ~10 per user | ~100 k | ~2 M | Purge read + 90 d |
| `qualified_leads` | 1 per real intent | ~50 k | ~1 M | **Keep — business record** |
| `payment_transactions` | 1 per purchase | ~5 k | ~100 k | **Keep — accounting** |

**Do not introduce partitioning now.** Only `pandit_exposure` plausibly justifies it, and not before ~50 M rows. Design the retention jobs first; they will likely defer partitioning indefinitely.

**Do not auto-delete** `payment_transactions`, `pandit_subscriptions`, `qualified_leads`, `admin_activity_log`. NOT VERIFIED: Indian accounting retention requirements (commonly cited as 8 years under the Companies Act) — **confirm with an accountant before writing any payment retention policy.**

### Backup architecture — currently absent

**PROVEN: no backup of any kind exists.** No `pg_dump`, no snapshot automation, no backup scripts anywhere in the repository or on the host. The entire production database is one local Docker volume (`all-india-pandit_db_data`) on one EC2 instance whose root filesystem is **93 % full with 606 MB free**.

Required target state:

| Layer | Setting |
|---|---|
| Automated backups | enabled, **retention 14–35 days** |
| PITR | enabled (implied by automated backups) |
| Manual snapshot | **before every migration**, tagged with the release id |
| AWS Backup | daily plan, 35-day retention |
| Cross-region copy | ap-south-1 → ap-southeast-1, weekly |
| Cross-account copy | when a second account exists (ransomware/compromise isolation) |
| Deletion protection | **ON** |
| `SkipFinalSnapshot` | **false** |

### Restore drill — mandatory before go-live

A backup that has never been restored is not a backup.

```
□ Snapshot → restore to a NEW instance (never over production)
□ PITR → restore to T-30min on a new instance
□ Baseline → apply to an empty database, confirm it matches the schema checksum
□ Verify on the restored instance:
    □ row counts match expectation for the chosen timestamp
    □ all 15 RLS tables still report relrowsecurity = true
    □ 57 policies present
    □ 14 SECURITY DEFINER functions present, PUBLIC still revoked
    □ record_qualified_lead has arity 7 and the single-bigint advisory lock
    □ app role grants: exactly 276 rows
    □ zero users matching @test.local / @panditsuggest.test / @panditconnect.demo
    □ payment_transactions ↔ pandit_subscriptions reconcile
    □ point the app at the restored instance; /health green; one real read path
□ Record wall-clock restore time  → this is your real RTO
□ Repeat quarterly and after any major schema change
```

### RPO / RTO — recommendations, not requirements

NOT VERIFIED: no business-defined targets exist. Proposed:

| Stage | RPO | RTO | Delivered by |
|---|---|---|---|
| **Early production** (now → first 1k users) | **5 min** | **1–2 h** | Multi-AZ + PITR + practised manual restore |
| **Growth** (revenue-bearing) | **1 min** | **15 min** | + read replica, automated failover runbook |

These need explicit sign-off. RPO of 5 minutes means accepting that up to 5 minutes of leads and payments can be lost — a business decision, not a technical one.

---

## 21. Failure scenario matrix (Phase 43)

| Scenario | Detection | Impact | Automatic protection | Manual recovery | Data loss? |
|---|---|---|---|---|---|
| Migration fails halfway | Runner exit 1 | Partial schema; app may 500 | Self-checks in 30/34 files | Restore pre-migration snapshot | **Possible today** (no snapshot) |
| Backend deploy fails | Health check | Old version serves | Container restart | Roll back image | No |
| RDS unavailable | CloudWatch + 5xx | Full outage | **None today**; Multi-AZ after migration | Failover / restore | Up to RPO |
| RDS failover | Connection errors ~60 s | Brief 5xx | Multi-AZ | pool reconnect | No |
| **Developer runs migrate twice** | **Fails at 25** | 26–36 never apply | none | Fix 25 | No |
| **Developer edits an applied migration** | **NONE** | Silent divergence | **none** | — | Possible |
| **Wrong DATABASE_URL** | none | Writes to wrong DB | name check only, `NODE_ENV=test` only | — | **Yes** |
| **Test suite points at production** | **NONE when `NODE_ENV` unset** | **Fixture rows in prod — has happened** | guard is **inactive** without `NODE_ENV=test` | manual cleanup | **Yes — 633 rows already** |
| Admin deletes important data | audit log | Data loss | soft deletes; no DELETE policies | PITR | **Yes without PITR** |
| Payment webhook repeats | `webhook_events` | none — idempotent expiry | UNIQUE dedupe key | — | No |
| Lead request repeats | `interaction_count` | none | advisory lock + rolling window | — | No |
| **Disk nearly full (93 % now)** | none configured | **DB halts on write** | **none** | free space / resize | **Yes — corruption risk** |
| Schema/app version mismatch | 500s | Partial outage | none | roll back app | No |

---

## 22. CI, staging, release (Phases 37–40)

**VERIFIED: there is no CI. `.github/workflows/` does not exist.** Every gate below has to be built from zero.

Target CI job on every PR touching `db/`:

```
1  spin up empty postgres:16 + postgis + pgvector
2  apply 000-baseline-schema.sql            → must succeed
3  apply all pending migrations             → must succeed
4  assert schema_migrations count is correct
5  restore last release's schema, apply pending  → UPGRADE path must succeed
6  pg_dump --schema-only both paths, diff   → must be identical (zero drift)
7  npm test with NODE_ENV=test              → must pass
8  assert zero rows matching fixture patterns
9  destroy
```

Both **fresh install** and **upgrade from previous** must be proven on every PR.

**Staging: yes, required.** Structurally identical to production, synthetic data only, never a copy of production PII unless sanitised. Every migration runs on staging first; promotion gate = migration applied + full test suite + a restore drill on the staging snapshot.

**Rollback philosophy.** Application rollback is cheap; schema rollback usually is not. Per class:

| Class | Strategy |
|---|---|
| Additive (nullable column, new table, index) | forward-fix; DOWN is trivial but rarely needed |
| Function replacement | **keep the previous definition in a new migration** — never a DOWN |
| RLS/grant change | forward-fix, immediately |
| Backfill / repair | **not reversible** — snapshot first, forward-fix only |
| Destructive DDL (drop/rename/type change) | **expand/contract across ≥3 releases**; recovery is PITR |

Do not write DOWN migrations by default. Require a pre-migration snapshot instead.

**Expand/contract rules for every future release:**

| Safe (EXPAND) | Dangerous (needs CONTRACT phase) |
|---|---|
| add nullable column | rename column |
| `CREATE INDEX CONCURRENTLY` | drop column |
| add table | change column type |
| `ADD CONSTRAINT … NOT VALID` then `VALIDATE` | `SET NOT NULL` directly |
| add enum value (never used same txn) | drop/rename enum value |
| backfill in batches with `lock_timeout` | single large `UPDATE` |

---

## 23. Real-data AWS cutover (Phase 41)

Because there is effectively **no real business data** (§9), this is a clean bootstrap, not a data migration. That is a significant advantage and should be used deliberately.

```
□  1  Human decision: are the 4 gmail.com accounts real? If yes, export those
      rows only, by hand, reviewed.                              ← BLOCKING, NOT VERIFIED
□  2  Provision RDS PG16 Multi-AZ, private, encrypted, deletion protection ON
□  3  Create the 4 roles (§19). Passwords generated into Secrets Manager, never in git
□  4  Apply 000-baseline-schema.sql as panditsuggest_migrator
□  5  Apply 001-production-config-seed.sql — config + catalogue ONLY, no users
□  6  Run acceptance gates (§24). Any failure stops the cutover
□  7  Create the single genuine super_admin out-of-band (interactive script,
      never a migration, TOTP enrolled immediately)
□  8  Take a manual snapshot: "clean-baseline-T0"
□  9  Restore that snapshot to a scratch instance and verify → proves DR works
□ 10  Point staging at a copy; run the full suite against it
□ 11  Repoint backend DATABASE_URL to RDS via Secrets Manager; TLS enforced
□ 12  Smoke test: signup → OTP → pandit view → contact click → qualified lead
      → Razorpay test payment → subscription activation → admin panel
□ 13  Enable Performance Insights, CloudWatch alarms, daily health checks (§24)
□ 14  Decommission the Docker postgres ONLY after a successful restore drill
      from RDS. Keep a final pg_dump of the old volume in S3 regardless
```

---

## 24. Acceptance gates & ongoing health checks (Phases 36, 42)

**Before AWS production can be called ready — all must pass:**

```
□ Fresh build from baseline succeeds TWICE on empty databases
□ Migration ledger present; re-running the migrator is a no-op
□ Checksum tamper test: edit an applied migration → runner ABORTS
□ Concurrent migrator test: second runner blocks, does not double-apply
□ Zero fixture users / zero fake payments / zero fake leads
□ P0-1 backups + PITR enabled and a restore PROVEN
□ P0-3 test isolation closed (see below)
□ P0-4 users RLS column exposure closed
□ P0-5 migration 25 fixed
□ P1 activate_pandit_subscription validates
□ P1 reset attempts incremented (or column removed)
□ P1 ai_query_analytics protected
□ All 14 SECURITY DEFINER functions pin search_path
□ FORCE ROW LEVEL SECURITY on all 15 RLS tables
□ TLS enforced end to end; secrets in Secrets Manager; app password rotated
□ Lead-distribution, payment and RLS test suites green
□ CI fresh-install + upgrade both green
□ pgvector version on target RDS confirmed ≥ 0.8.x
```

**Daily automated assertions (non-destructive):**

```sql
-- 1  no test data, ever again
SELECT count(*) FROM users
 WHERE email LIKE '%@test.local' OR email LIKE '%@panditsuggest.test'
    OR email LIKE '%@panditconnect.demo' OR email LIKE '%@example.com';   -- must be 0

-- 2  no unexpected admins
SELECT count(*) FROM users WHERE role IN ('admin','super_admin');          -- must equal known N

-- 3  RLS intact
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity;          -- must be >= 15

-- 4  policy count intact
SELECT count(*) FROM pg_policies WHERE schemaname='public';               -- must be 57

-- 5  grant surface intact
SELECT count(*) FROM information_schema.role_table_grants
 WHERE grantee='panditsuggest_app' AND table_schema='public';             -- must be 276

-- 6  subscription invariant
SELECT count(*) FROM (SELECT pandit_id FROM pandit_subscriptions
  WHERE is_active GROUP BY pandit_id HAVING count(*)>1) x;                -- must be 0

-- 7  tier without payment
SELECT count(*) FROM pandits p WHERE p.current_tier <> 'free'
  AND NOT EXISTS (SELECT 1 FROM payment_transactions t
    WHERE t.pandit_id=p.id AND t.status='completed');                     -- investigate any

-- 8  lead invariant
SELECT count(*) FROM qualified_leads WHERE market IS NULL;                -- must be 0

-- 9  schema drift
--    pg_dump --schema-only | sha256sum  vs stored baseline checksum

-- 10 migration ledger matches files on disk
```

**Monitoring thresholds** (assumptions, to be tuned): CPU >80 % for 10 min · FreeStorageSpace <20 % · connections >70 % of max · deadlocks >0 · transactions open >5 min · replica lag >30 s · failed connections spike. Enable Performance Insights (7-day free tier) and `log_min_duration_statement = 1000` (currently `-1` — no slow-query logging at all).

---

## 25. Complete findings register

### P0 — data loss / compromise / cannot restore

| ID | Finding | Evidence |
|---|---|---|
| **P0-1** | **No backup exists.** No `pg_dump`, snapshot, or backup tooling anywhere. Single Docker volume on one EC2 with 606 MB free (93 % full). Disk exhaustion halts writes and risks corruption with no recovery path. | PROVEN — repo + host search, `df` |
| **P0-2** | `01-schema.sql` cannot build a fresh DB; leaves 22 tables, **0 policies, 0 RLS, 0 grants**, not rolled back. | PROVEN on scratch DB |
| **P0-3** | **9 `npm run test:*` scripts omit `NODE_ENV=test`.** `testDbGuard` returns immediately unless `NODE_ENV==='test'`; `backend/.env` does not exist, so `DATABASE_URL` is unset and both `config/db.js` and `tests/helpers.js` fall back to **production** — the latter as `panditconnect:panditconnect`, a **BYPASSRLS superuser**. 5 of those scripts load `helpers.js`. | VERIFIED by source. **Deliberately not executed.** |
| **P0-4** | Anonymous app-role connection reads **100 % of `users`**, incl. `password_hash` of the admin (via the blog-author branch of `users_select_via_public_content`). | PROVEN on scratch DB |
| **P0-5** | `npm run db:migrate` aborts at migration 25 (`ALTER TABLE faqs RENAME` without `IF EXISTS`); 26–36 unreachable. Second, prod-only failure: self-check needs ≥8 GLOBAL FAQs, prod has 1. | PROVEN both passes |
| **P0-6** | Production is 99.4 % non-real (633/637 users). All 24 admin accounts are test fixtures. Not a viable migration source. | VERIFIED by email-domain attribution |

### P1 — deployment blocker / security integrity

| ID | Finding |
|---|---|
| P1-1 | `activate_pandit_subscription()` — SECURITY DEFINER, zero validation, disables seat cap; grants any tier to any pandit |
| P1-2 | `password_reset_challenges.attempts` never incremented — brute-force guard is dead code |
| P1-3 | `ai_query_analytics` stores verbatim user queries (incl. mental-health content) with **no RLS** and DELETE granted to the app role |
| P1-4 | All 14 SECURITY DEFINER functions lack `SET search_path` (currently mitigated: app role has no CREATE on `public`) |
| P1-5 | `payment_transactions` has no UNIQUE on `gateway_payment_id`/`gateway_order_id`; `pandit_subscriptions` has no "one active per pandit" constraint |
| P1-6 | No migration ledger, no checksum, no advisory lock — concurrent deploys and edited-after-apply migrations are both undetected |
| P1-7 | Migration 21 makes `pandit_analytics` RLS fully permissive (`SELECT USING (true)` alongside `INSERT`/`UPDATE` `true`) — `analytics_select_own` is dead |
| P1-8 | Seeded admin `admin@panditconnect.demo` active with a bcrypt hash committed to git and shared by 22 other accounts |
| P1-9 | No TLS: server `ssl = off`, client requests none. Blocking for RDS |
| P1-10 | `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` all `0` on server and unset on client |
| P1-11 | `panditconnect_app` password (`panditconnect_app_dev`) committed in `01-schema.sql` + `docker-compose.yml`; all secrets in a plaintext `.env` |
| P1-12 | No CI at all — no fresh-install or upgrade proof on any change |
| P1-13 | `relforcerowsecurity = false` everywhere; any owner-role connection silently bypasses all 57 policies |

### P2 — medium operational risk

| ID | Finding |
|---|---|
| P2-1 | Migration 12 re-creates the insecure `ai_conv_guest`/`ai_msg_guest` `FOR ALL` policies that migration 13 exists to remove; correct only because 13 always follows |
| P2-2 | Webhook dedupe / activate / mark-processed span three transactions — crash window leaves stale `'received'` and re-runs activation (harmless: expiry is idempotent) |
| P2-3 | `seat_usage()` race — no lock; concurrent sales can both pass a full cap |
| P2-4 | Migration 34 `REPLACE(url,'.jpg','.webp')` is unanchored and re-runs forever, rewriting future admin JPEG uploads |
| P2-5 | Migration 33 backfill re-runs, silently re-activating accounts an admin set back to `pending_verification` |
| P2-6 | Migration 14 re-asserts a permanent invariant on every run and can rewrite `profile_photo_url` |
| P2-7 | 20 files contain mid-file `COMMIT` → half-apply possible |
| P2-8 | `02-seed.sql`: 619 INSERTs, 0 `ON CONFLICT` — `db:init` not re-runnable |
| P2-9 | Admin mutation and `admin_activity_log` write are not in one transaction |
| P2-10 | Schema drift: `home_hero_images.gallery` + index exist in prod, in no migration, used by no code |
| P2-11 | No scheduled purge for expired sessions, OTPs, reset challenges |
| P2-12 | `connectionTimeoutMillis = 0`, `max` unset, no `application_name`, no `keepAlive` |
| P2-13 | Schedulers run on every backend instance with no leader election |
| P2-14 | 49 FK columns unindexed — cascade-delete cost at scale |
| P2-15 | `.sort()` ordering breaks at migration 100 |
| P2-16 | Migration 12 seeds 13 synthetic rows into `ai_query_analytics`, mixing fabricated and real demand data |

### P3 — hygiene

| ID | Finding |
|---|---|
| P3-1 | Dead/broken tooling: `src/utils/migrations.js` (never called, prints a Windows path), `scripts/fix-migrations.sql` + `run-all-migrations.sql` (`C:/maa-baglamukhi-project/...`), `run-migration.js` / `run-migration-super.js` (wrong port 5432, cover only 03–08) |
| P3-2 | `wipe.sql` references the renamed `faqs` table — fails |
| P3-3 | `notification_type` retains `festival_alert` / `panchang_alert` after migration 24 |
| P3-4 | `site_images.updated_at` has no trigger |
| P3-5 | No DELETE policies on RLS tables — deletes silently affect 0 rows |
| P3-6 | App role has full write on PostGIS `spatial_ref_sys` |
| P3-7 | Tier `free` has no `plan_market_entitlements` rows — undocumented exclusion |
| P3-8 | Migration 19's header misdescribes downgrade behaviour |
| P3-9 | `idx_temple_services_temple` created twice |

---

## 26. What is genuinely well built

Worth stating plainly, because the redesign should preserve it:

- **The migration set is fundamentally sound.** One ordering defect; everything else applies cleanly and 33/34 are truly idempotent. That is unusual and it is PROVEN, not asserted.
- **Zero drift in RLS policies and grants** between production and a from-scratch rebuild — the security model has stayed in source.
- **Least privilege is real and verified**: 13 tables carry deliberately narrowed grants; audit logs are append-only at the grant level; `qualified_leads` cannot be deleted; `distribution_config` and `plan_market_entitlements` are read-only to the app.
- **`record_qualified_lead()` is a model of defensive DB design** — re-validates every invariant, correct advisory locking, derives market from verified evidence rather than caller input.
- **`withAiContext()`** correctly sets both GUCs on one connection in one transaction, and explains why the naive version fails closed.
- **Migration 20** is an exemplary bug writeup and fix. **Migration 13** is a serious security fix with a self-check that proves the property it claims.
- **Self-checks in 30/34 migrations** turn silent no-ops into loud failures.
- **`testDbGuard.js`** is the right *shape* — synchronous, pre-pool, honest about the incident. Its problem is trigger coverage (P0-3), not design.
- **Payment expiry is idempotent by construction**, which converts what would have been a revenue-corruption bug into a cosmetic one.

---

## FINAL VERDICT

# MORE INFORMATION REQUIRED

The technical picture is now well evidenced and the architecture in §19–§24 can largely be drafted. But four items are **decisions or facts I cannot obtain safely**, and each one changes the design:

1. **Are the 4 `gmail.com` accounts real users?**
   Everything else is provably test data. If any of these are real people with real leads or payments, cutover needs a reviewed data export; if not, it is a pure clean bootstrap. *NOT VERIFIED — needs a human to look at 4 rows.*

2. **Does an RDS instance already exist in account 376834080419?**
   `rds:DescribeDBInstances` is denied to `PanditSuggestEC2MediaRole`. The absence of RDS permissions suggests none, but this is not proven. *Needs a read-only credential or a console check.*

3. **Which pgvector version does the target RDS PG16 minor ship?**
   Live is 0.8.6 and the HNSW index depends on it. If the target offers less, migration 12 fails or the index degrades. *Needs `aws rds describe-db-engine-versions --include-all`.*

4. **Business RPO/RTO and payment-record retention.**
   §20 proposes 5 min / 1–2 h and "do not auto-delete payments", but acceptable data loss and statutory retention (commonly cited as 8 years for Indian accounting records) are business and legal decisions, not technical ones. *Needs sign-off from you and an accountant.*

**Additionally, three things should be fixed before the architecture work rather than after, because they are actively dangerous today:**

- **P0-1** — take a `pg_dump` of production **now** and get it off this host. There is currently no copy of the database anywhere, and the disk is 93 % full.
- **P0-3** — add `NODE_ENV=test` to the nine test scripts, and make `assertSafeForTests` fail when `NODE_ENV` is *unset* rather than returning early. This is the live mechanism that put 633 fixture rows into production and it can fire again from one command.
- **Free disk space on the EC2 host.** At 606 MB, a routine log rotation or Docker build can stop the database.

This phase is evidence collection only. **Do not read this as "ready for production."**

---

*Read-only against production throughout. All destructive experiments ran on `audit_scratch_fresh`, created and dropped within this session; production user count was 637 before and 637 after, and the repository working tree was not modified.*
