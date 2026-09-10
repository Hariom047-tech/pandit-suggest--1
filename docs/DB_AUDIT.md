# Database Folder Audit — `backend/src/db/`

**Date:** 2026-09-06
**Scope:** every file in `backend/src/db/` (36 files, `01-schema.sql` … `36-site-images.sql`, 7,112 lines), plus the runners and helpers that execute them: `scripts/migrate.js`, `scripts/init-db.js`, `src/config/db.js`, `src/utils/migrations.js`, `src/config/testDbGuard.js`, `run-migration*.js`, `wipe.sql`, `scripts/*.sql`.
**Method:** full read of every file, plus read-only verification against the live `panditconnect-db` container (PostgreSQL 16.15, `check_function_bodies=on`). Every claim marked **verified** below was reproduced against that database; transaction probes were rolled back.

> **Note on the count:** the request said 33 files. There are **36** (`01`–`36`, no gaps). All 36 were audited.

---

## 1. Executive summary

The migration set is, in craft terms, unusually good. Almost every file is idempotent, guards its `GRANT`s behind a `pg_roles` check, ends in a `DO $verify$` self-check that fails loudly, and carries a header explaining *why* the change exists and what bug it fixes. The RLS model is real (the app connects as a non-owner role), and the `SECURITY DEFINER` pattern for pre-authentication lookups is applied consistently and narrowly.

That makes the defects below more surprising, not less. **Three of them are blockers**, and each is invisible during normal operation because the running database predates the code that would break it:

| # | Finding | Impact |
|---|---|---|
| **B1** | `01-schema.sql` cannot create a fresh database — forward reference to `contact_clicks` | A fresh `docker compose up` produces **no database at all** |
| **B2** | `npm run db:migrate` aborts at migration 25 | Migrations **26–36 are unreachable** through the documented path |
| **B3** | Production DB is **89 % test-fixture data**; all 24 `admin` accounts are test fixtures | Live data integrity + admin surface |

Nothing here is a live remote-exploit. The blockers are disaster-recovery and deployment failures — they only surface the moment you need to rebuild, which is the worst possible time to discover them.

---

## 2. Blockers

### B1 — `01-schema.sql` fails on a fresh database (forward reference)

**Verified.**

`get_pandit_lead_counts()` is created at [`01-schema.sql:807`](../backend/src/db/01-schema.sql#L807) and its body reads `contact_clicks` at line 815:

```sql
      FROM contact_clicks c WHERE c.created_at >= p_since GROUP BY c.pandit_id
```

`CREATE TABLE contact_clicks` is at **line 838** — 23 lines later.

PostgreSQL validates `LANGUAGE sql` function bodies at creation time whenever `check_function_bodies` is on. The live server has it on (verified: `check_function_bodies = on`, PostgreSQL 16.15). A rolled-back probe against that server confirms the behaviour:

```
BEGIN
ERROR:  relation "__nope_missing_tbl" does not exist
ROLLBACK
```

**Consequence.** The postgres image runs `/docker-entrypoint-initdb.d/*` with `ON_ERROR_STOP=1`, so `docker compose down -v && docker compose up -d` aborts at line 807. Everything after it — `contact_clicks`, subscriptions, payments, blog, notifications, **all RLS policies, all views, and all `GRANT`s to `panditconnect_app`** — is never created. `scripts/init-db.js` sends the file as one `client.query()`, so there the whole file rolls back instead.

**Why nobody has hit it.** `git blame` puts this block in commit `093304d` (2026-08-06). The running database was created before that commit, so the live server has a working `contact_clicks` and has never re-run `01-schema.sql`.

**Fix.** Move the `get_pandit_lead_counts()` definition to after `CREATE TABLE contact_clicks` (line 838+). Migration 03 redefines the function anyway, so the 01 copy exists only to make the schema self-consistent — moving it costs nothing.

---

### B2 — `npm run db:migrate` is broken; migrations 26–36 cannot be applied

**Verified.**

[`25-universal-faqs.sql`](../backend/src/db/25-universal-faqs.sql) opens with:

```sql
ALTER TABLE faqs RENAME TO universal_faqs;
```

No `IF EXISTS`. The header of the file claims "Idempotent." It is not. Probe against the live database:

```
BEGIN
ERROR:  relation "faqs" does not exist
ROLLBACK
```

`scripts/migrate.js` iterates every file `03`…`36` on **every** run and `process.exit(1)`s on the first failure. So on any database where 25 has already applied — which is every real one — `npm run db:migrate` dies at 25 and **26, 27, 28, 29, 30, 31, 32, 33, 34, 35 and 36 never run**. Any migration added tomorrow is equally unreachable.

**A second, independent break in the same file.** Its self-check demands:

```sql
IF global_count < 8 THEN
    RAISE EXCEPTION 'Migration 25 incomplete — expected >= 8 published GLOBAL FAQs, found %', global_count;
```

The live database has **1** (verified — 4 `universal_faqs` rows total: one each of `GLOBAL`, `HOME`, `SERVICE`, `PANDIT`, all published). Admin activity since the migration ran has invalidated the assumption. So even after fixing the rename, migration 25 still fails.

**Fix.**
1. `ALTER TABLE IF EXISTS faqs RENAME TO universal_faqs;`
2. Make the count assertion tolerant — the migration's job is the *rename and reshape*, not policing how many FAQs an admin keeps. Assert the table and its columns exist; drop the row-count gate, or reduce it to a `RAISE WARNING`.
3. Structural: add a migration ledger (see L23) so applied migrations are skipped rather than re-executed and re-asserted forever.

---

### B3 — The production database is 89 % test-fixture data

**Verified** against the live database:

| Metric | Count |
|---|---|
| `users` total | **637** |
| …matching test-fixture patterns | **567 (89 %)** |
| `pandits` total | 461 (399 test-ish) |
| `users` with `role = 'admin'` | **24 — every one a test fixture** |
| `super_admin` | 1 (`patidarhariom047@gmail.com`, TOTP enabled — the genuine account) |

The 24 admin rows are `fixture-admin-<hex>@test.local`, `admin-test-<epoch>@panditconnect.demo` and `pause-admin-<hex>@test.local`. All are `status = 'active'`. Three have `totp_enabled = true`.

Mitigating: **no live admin sessions** belong to any of them (verified: 0 rows in `admin_sessions` unexpired and unrevoked for a test-fixture user).

This is precisely the incident [`src/config/testDbGuard.js`](../backend/src/config/testDbGuard.js) documents in its own header ("a full test run left ~250 fake pandit/user/temple/payment rows live"). The guard now **prevents recurrence** and is well built — a synchronous string check that fires before any pool is constructed. But the rows it was written about were never cleaned up, and the population has since grown from ~250 to 567.

**Fix.** A reviewed cleanup script, run against a backup first, deleting users matching the fixture patterns and cascading. Every fixture-admin row in particular should go: an active `role='admin'` account is a real authorization surface, whatever its email domain. Then add a scheduled assertion (`count(*) FROM users WHERE email LIKE '%@test.local'` must be 0) so regrowth is caught in days, not months.

---

## 3. High-severity findings

### H4 — `activate_pandit_subscription()` grants any tier to any pandit, unvalidated

[`29-pandit-tier-system-writes.sql`](../backend/src/db/29-pandit-tier-system-writes.sql), extended by [`32-pandit-pause.sql`](../backend/src/db/32-pandit-pause.sql):

```sql
CREATE OR REPLACE FUNCTION activate_pandit_subscription(p_pandit_id UUID, p_tier subscription_tier, p_expires_at TIMESTAMPTZ)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.allow_seat_overflow', 'on', true);
    UPDATE pandits SET current_tier = p_tier, subscription_expires_at = p_expires_at, is_paused = FALSE, ... WHERE id = p_pandit_id;
```

It is `SECURITY DEFINER`, granted to `panditconnect_app`, and performs **zero validation**. It does not check that a captured payment exists, that the tier matches what was paid for, or that the expiry is sane. It also unconditionally disables the seat cap.

This is a sharp contrast with `record_qualified_lead()`, whose own header states the principle correctly: *"it re-validates every qualification invariant itself, so even a bug in the Node layer cannot persist a lead for…"*. That reasoning applies with more force here — this function is the one that decides who has paid.

Any bug or injection that reaches this function grants unlimited free `diamond` tiers.

**Fix.** Require evidence inside the function body: a `payment_transactions` row for `p_pandit_id` with `status = 'completed'`, matching `plan_id`'s tier, created within a short window — or an explicit `p_admin_id` that resolves to an admin, audited to `admin_activity_log`. Narrow `app.allow_seat_overflow` to the payment path only.

### H5 — Every seeded user shares one committed bcrypt hash, including an admin

[`02-seed.sql:7`](../backend/src/db/02-seed.sql#L7) creates `admin@panditconnect.demo` with `role='admin'`, `status='active'`, `email_verified=TRUE` — and the identical `$2a$10$…` hash used by all 23 seeded users. That hash runs on every fresh database. An `active` admin account whose password is in the repository, shared with 22 other accounts, is not a demo detail.

**Fix.** Seed the demo admin as `status='pending_verification'` with `password_hash = NULL`, or drop the row entirely and provision the first admin out-of-band.

### H6 — `password_reset_challenges.attempts` is never incremented — the brute-force guard is dead

[`03-qualified-leads.sql`](../backend/src/db/03-qualified-leads.sql) gates redemption on `attempts < max_attempts`:

```sql
    UPDATE password_reset_challenges SET consumed_at = NOW()
     WHERE token_hash = p_token_hash AND consumed_at IS NULL ... AND attempts < max_attempts
```

**Verified:** nothing in `src/db/*.sql` or `src/**/*.js` ever writes `password_reset_challenges.attempts`. (The only `attempts = attempts + 1` in the codebase is `auth.repository.js:181`, and it targets `otp_verifications`.) The column is permanently 0, the predicate always true, the guard decorative. Token guessing is rate-limited only at the HTTP layer.

**Fix.** Increment `attempts` on every failed redemption inside `auth_consume_reset_challenge` (an `UPDATE … SET attempts = attempts + 1 WHERE token_hash = …` in the `NOT FOUND` branch), or delete the column and its predicate so the protection isn't implied where it doesn't exist.

### H7 — Migration 21 makes `pandit_analytics` RLS decorative

[`21-fix-analytics-upsert-rls.sql`](../backend/src/db/21-fix-analytics-upsert-rls.sql) adds `analytics_select_system FOR SELECT USING (true)`. Combined with the pre-existing `analytics_write_system` (`WITH CHECK (true)`) and `analytics_update_system` (`USING (true)`), the table now has RLS enabled and **no restriction whatsoever** on any operation. `analytics_select_own` — the policy that scoped a pandit to their own metrics — is dead: the permissive union always wins.

The diagnosis in that file is correct and well-researched (the `ON CONFLICT DO UPDATE` + RLS visibility rule is real). The fix is broader than the problem.

**Fix.** Route the daily-rollup upsert through a narrow `SECURITY DEFINER` function — exactly the pattern this schema already uses seven times elsewhere — and drop `analytics_select_system`. That keeps one pandit's click counts out of another pandit's session.

### H8 — `users_select_public` exposes secret columns at the row level

```sql
CREATE POLICY users_select_public ON users
    FOR SELECT USING (role IN ('pandit', 'temple_admin'));
```

RLS is row-level, not column-level. Any query the app makes against `users` in an anonymous context can read **`password_hash`, `totp_secret_encrypted`, `google_id`, `facebook_id`, `date_of_birth`, `phone`** for every pandit on the platform. Today the only thing preventing a leak is that application queries name their columns.

Note this is load-bearing in one direction: `auth_find_user_by_email()` and `auth_find_user_by_phone()` return `SETOF users`, so the sensitive columns *must* remain readable through those paths. But those are `SECURITY DEFINER` and bypass RLS anyway.

**Fix.** Add a `v_users_public` view (or `SECURITY DEFINER` accessor) exposing only the directory-visible columns, grant `SELECT` on that, and drop `users_select_public`. If that is too large a change, at minimum add a schema test asserting no public code path selects `users.*`.

### H9 — `ai_query_analytics` stores raw devotee query text with no RLS

Migration 13's header is unambiguous about how sensitive this content is: *"People who are not logged in describe depression, divorce, infertility, debt and court cases there, and the crisis path means some of them are describing wanting to die."*

`ai_conversations` and `ai_messages` are then locked down per session key, correctly and carefully. But [`12-ai-foundation.sql`](../backend/src/db/12-ai-foundation.sql) also creates `ai_query_analytics` with `query_text TEXT NOT NULL` holding the same words — and **verified live: `rls_on = f`, 0 policies**, with full `SELECT/INSERT/UPDATE/DELETE` granted to the app role.

The most sensitive text in the database is protected in one table and unprotected in its twin.

**Fix.** Either enable RLS with an admin-only `SELECT` policy, or stop storing raw `query_text` — the demand-gap analytics need `detected_intent`, `problem_category`, `requested_service` and `requested_city`, not the verbatim sentence.

### H10 — Migration 22's grants are unguarded

Every other migration in the set wraps `GRANT` in `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'panditconnect_app')`. Migration 17 exists specifically to add that guard where migration 15 omitted it, and explains at length why it matters.

[`22-user-activity-events.sql`](../backend/src/db/22-user-activity-events.sql) ends with bare statements:

```sql
REVOKE UPDATE, DELETE ON user_activity_events FROM panditconnect_app;
GRANT SELECT, INSERT ON user_activity_events TO panditconnect_app;
```

On any database without the role — a fresh dev clone, CI — this raises `role "panditconnect_app" does not exist` and fails the migration. Migration 22 is also the only file in the set with **no `BEGIN`/`COMMIT` and no self-check**.

**Fix.** Wrap in the standard `DO $grants$ … IF EXISTS (pg_roles) …` block.

---

## 4. Medium-severity findings

### M11 — Seat-cap enforcement has a race, and its comment misdescribes it

[`19-seat-cap-enforcement.sql`](../backend/src/db/19-seat-cap-enforcement.sql)'s `enforce_seat_cap()` reads a count and compares it, with no lock:

```sql
    SELECT * INTO v FROM seat_usage(NEW.current_tier);
    IF v.held >= v.seat_cap THEN RAISE EXCEPTION 'seat_cap_reached' ...
```

Two concurrent sales both read `held = 199` against a 200 cap and both commit. `record_qualified_lead()` in the same codebase solves the identical problem correctly with `pg_advisory_xact_lock` — that pattern belongs here too, keyed on the tier.

Separately, the file's own header states the trigger does **not** block *"downgrades, and moves away from a full tier."* Moving *away* is indeed unaffected, but the code blocks arrival at **any** capped tier — so a `gold → silver` downgrade into a full silver tier **is** blocked. The comment will mislead the next reader.

### M12 — Migration 34's URL rewrite is unanchored and re-runs forever

```sql
UPDATE temples SET cover_image_url = REPLACE(cover_image_url, '.jpg', '.webp')
 WHERE cover_image_url LIKE 'https://media.panditsuggest.com/temples/%.jpg';
```

`REPLACE` substitutes *every* occurrence, not the extension — a key containing `.jpg` mid-string is corrupted. And because migrate re-runs it, any JPEG cover an admin uploads in future is silently rewritten to a `.webp` that may not exist in S3. The self-check then `RAISE EXCEPTION`s if any remain, so the rewrite is mandatory rather than opportunistic.

**Fix.** `regexp_replace(cover_image_url, '\.jpg$', '.webp')`, and downgrade the self-check to a `RAISE NOTICE` — this was a one-time content move, not an invariant.

### M13 — Migration 33's backfill re-runs and undoes admin decisions

```sql
UPDATE users SET status = 'active'
WHERE status = 'pending_verification' AND (phone_verified = TRUE OR email_verified = TRUE);
```

Correct as a one-time backfill. But it executes on every `db:migrate`, so an account an admin deliberately returns to `pending_verification` is silently re-activated on the next run. Migration 33 also has no `BEGIN`/`COMMIT` and no self-check.

### M14 — Migration 14 is a one-shot data repair that re-runs with a hard-failing assertion

[`14-pandit-profile-photo-repair.sql`](../backend/src/db/14-pandit-profile-photo-repair.sql) re-points `pandits.profile_photo_url` at the first `pandit_media` row on every migrate, and `RAISE EXCEPTION`s if any pandit's avatar doesn't match one of their own uploads. Currently clean (verified: 0 stranded rows), but it means a deliberate admin choice — or the S3/CDN URL divergence introduced by migration 26 — can turn a routine `db:migrate` into a failure or a silent overwrite. A completed repair should become a no-op, not a permanent invariant.

### M15 — Files with a mid-file `COMMIT` can half-apply

`scripts/migrate.js` sends each file as one `client.query(text)` — a multi-statement simple query, which PostgreSQL wraps in a single implicit transaction. Files that `COMMIT` in the middle and then run trailing `DO` blocks (04, 10, 11, 12, 13, 15, 16, 18, 19, 20, 25, 26, 27, 28, 29, 31, 32, 34, 35, 36) will keep the committed half if a later statement fails, leaving a half-applied state that the next run's assertions may not detect. Worth knowing; the self-checks mitigate it in practice.

### M16 — Migration 12 re-opens the guest-AI hole that migration 13 exists to close

Migration 12 creates:

```sql
CREATE POLICY ai_conv_guest ON ai_conversations FOR ALL USING (user_id IS NULL AND session_key IS NOT NULL);
```

Migration 13 exists solely to drop this — its header calls it out as a **SECURITY FIX** and explains that the policy "makes EVERY guest conversation on the platform readable, updatable and deletable by any caller holding the app role."

But 12 still contains it. The final state is only correct because 13 always runs immediately after. Anyone re-running 12 alone — to repair the AI tables, say — silently reopens cross-guest reads of the most sensitive rows in the database.

**Fix.** Remove the insecure policy from migration 12 entirely and let 13's split `INSERT`/`SELECT`/`UPDATE` policies be the only definition.

### M17 — `02-seed.sql` is not re-runnable

**Verified:** 619 `INSERT` statements, **0** `ON CONFLICT` clauses. `npm run db:init` therefore fails on any database that already has data. The file is generated (`scripts/generate-seed-sql.js`), so this is a generator change, not 1,041 hand edits.

### M18 — Migration 12 seeds 13 synthetic rows into `ai_query_analytics`

Rows carrying `detected_intent = 'seeded_from_knowledge_base'` are inserted as real demand-gap records. Deliberate and documented, but it means the admin's demand report mixes fabricated queries with real ones. 20 rows exist live; 13 of them are seed. Any dashboard counting gaps should filter on that intent marker — worth stating explicitly wherever the report is read.

---

## 5. Low-severity / hygiene

| # | Finding |
|---|---|
| **L19** | **Dead and broken tooling.** `src/utils/migrations.js` exports `applyPendingMigrations()` — **verified: never called anywhere**, and its error message prints `C:\maa-baglamukhi-project\backend\scripts\fix-migrations.sql`, a Windows path from a former machine. `scripts/fix-migrations.sql` and `scripts/run-all-migrations.sql` both `\i C:/maa-baglamukhi-project/...` — unusable on this Linux host. `run-migration.js` and `run-migration-super.js` sit in the backend root, default to `postgres:postgres@localhost:5432` (wrong port and role — the project uses 5433 / `panditconnect`), and only cover migrations 03–08. All five should be deleted; `scripts/migrate.js` is the real runner. |
| **L20** | `wipe.sql` does `DELETE FROM faqs` — that table was renamed by migration 25, so the script fails. |
| **L21** | `notification_type` still has `'festival_alert'` and `'panchang_alert'` after migration 24 removed those features. Harmless, but the enum now describes a product that doesn't exist. |
| **L22** | `site_images` (36) has an `updated_at` column but no `trg_*_updated` trigger, unlike `universal_faqs` (25). The column will never change after insert. |
| **L23** | **No migration ledger.** Nothing records which migrations have been applied; `scripts/migrate.js` re-executes all 34 every time and relies entirely on each file being idempotent. That design is what makes B2 fatal rather than a warning, and what makes M12/M13/M14 re-run their one-time data moves forever. A `schema_migrations(filename, applied_at)` table would fix the whole class. |
| **L24** | No `DELETE` policies on any RLS-enabled table (`users`, `pandits`, `inquiries`, `qualified_leads`, `notifications`, …). Deletes silently affect 0 rows instead of erroring. Fail-closed and probably intended given the soft-delete design, but it should be stated rather than inferred. |
| **L25** | `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public` in `01-schema.sql` also grants write access on PostGIS's `spatial_ref_sys` (verified: full privileges live). Cosmetic, but the app role can corrupt the projection table. |
| **L26** | Tier `free` has **no** `plan_market_entitlements` rows, so free-tier pandits are structurally excluded from lead distribution (the model fails closed on a missing row). Almost certainly intended — but it is nowhere documented, and it is the kind of thing that reads as a bug during an incident. |
| **L27** | The `01-schema.sql` header says "Re-runnable in dev" — true in principle (`DROP SCHEMA … CASCADE`), false in practice because of B1. |

---

## 6. What is genuinely well done

Worth recording, because the fixes above should not disturb it:

- **Self-checks.** 30 of 34 migrations end in a `DO $verify$` block that raises on a silent no-op. Several catch subtle things — migration 27's check re-executes the advisory-lock call specifically to catch a regression it "almost shipped."
- **Guarded grants.** The `IF EXISTS (SELECT 1 FROM pg_roles …)` pattern is applied nearly everywhere, and migration 17 exists purely to retrofit it, with a clear explanation of the rollback hazard.
- **Least privilege, enforced and verified.** Live check confirms 13 tables carry deliberately narrowed grants: `security_audit_log`, `admin_activity_log`, `honeypot_logs` and `user_activity_events` are append-only to the app role; `distribution_config` and `plan_market_entitlements` are read-only; `qualified_leads` cannot be deleted.
- **`SECURITY DEFINER` used correctly.** Every pre-authentication lookup (`auth_find_user_by_email`, `auth_find_user_by_phone`, `admin_find_challenge_with_user`, `auth_find_pandit_for_reset`) is `REVOKE ALL … FROM PUBLIC` then granted only to the app role, and scoped to one query shape. `record_qualified_lead()` re-validates every invariant internally — the right instinct, and the reason H4 stands out.
- **Migration 20** is an exemplary bug report: it identifies that `pg_advisory_xact_lock(bigint, bigint)` has never existed, explains why the test suite masked it, fixes it, and adds a self-check that executes the exact call.
- **Migration 13** is a genuinely thoughtful security fix, including a self-check that scans `pg_policies` to prove no guest policy survives without a session-key comparison.
- **`testDbGuard.js`** is the right shape: synchronous, pre-pool, no network round trip, and honest about the incident that motivated it.
- **Comments explain *why*.** Almost every non-obvious decision — polymorphic FKs, JSONB over child tables, denormalised snapshots, the rolling-vs-tumbling dedup window — carries its reasoning and the alternatives rejected.

---

## 7. Recommended order of work

1. **B1** — move `get_pandit_lead_counts()` below `CREATE TABLE contact_clicks`. Then prove it: `docker compose down -v && docker compose up -d` against a scratch volume. Until this passes, the project has no working disaster recovery.
2. **B2** — `ALTER TABLE IF EXISTS`, relax the FAQ count assertion, then confirm 26–36 apply cleanly.
3. **L23** — add a `schema_migrations` ledger. This retires M12, M13, M14 and most of M15 as a class.
4. **B3** — backup, then remove the 567 fixture rows, starting with the 24 fixture admins. Add a recurring assertion.
5. **H4, H6** — the two authorization gaps with real teeth: validate `activate_pandit_subscription()`, make `attempts` real or remove it.
6. **H5, H9, H10, M16** — seed admin credential, `ai_query_analytics` RLS, migration 22 grant guard, remove the insecure policy from migration 12.
7. **H7, H8** — the two RLS designs that need a narrower replacement rather than a patch.
8. **M11, M12, M13** and the L-series hygiene items.

---

*Every "verified" claim in this document was reproduced read-only against the live `panditconnect-db` container on 2026-09-06. No data was modified; all transaction probes were rolled back.*
