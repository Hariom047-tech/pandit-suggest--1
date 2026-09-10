# Database Architecture

**Status:** production design, validated on scratch databases. Not yet cut over.
**Target:** AWS RDS PostgreSQL 16, ap-south-1, private, single-AZ to start.

---

## 1. The shape of it

```
backend/src/db/
  baseline/
    0000-production-baseline.sql    the entire schema, generated, applied once
  config/
    0001-production-config.sql      system + reference configuration, applied once
  migrations/
    0002-fk-supporting-indexes.sql  everything after launch, applied once each
  historical/
    01-schema.sql … 36-site-images.sql   provenance only — NEVER executed
  tools/
    00-bootstrap-rds.sql        run once as the RDS master (extensions, roles)
    00-bootstrap-dev.sql        the dev twin of the above
    hardening.sql               the security delta baked into the baseline
    build-baseline.sh           regenerates the baseline from historical/
    verify-schema.sql           post-apply assertions, run in CI and at cutover
    test-lead-payment.sql       lead + payment behavioural tests
    schema-fingerprint.sh       deterministic schema hash
    mark-dev-environment.sql    stamps a dev database as 'development'
```

**One bootstrap path, for every environment.** CI, a laptop, staging and
production all run `baseline -> config -> migrations` through
`scripts/migrate.js`. Nothing else builds a database. That is the property that
makes CI meaningful: if the fresh-install job is green, production's build works.

**`historical/` is a record, not a mechanism.** The 36 files that grew this
schema are kept for provenance — they explain *why* almost every object exists,
and several are excellent bug write-ups. They are never applied again. Replaying
them was the old deployment model and it had three fatal properties: file 01
could not build an empty database at all, file 25 aborted every run on any
database where it had already succeeded (so 26–36 were unreachable), and 20 of
the 34 incremental files contain data-mutating statements that are pure risk
against a database with no data to mutate.

---

## 2. Roles

Four roles, none of which is the RDS master account.

| Role | Login | Owns | May |
|---|---|---|---|
| `panditsuggest_owner` | **NO** | every table, function, index | nothing directly — reached only via `SET ROLE` during a deployment |
| `panditsuggest_migrator` | yes | `schema_migrations` only | deployments; member of `owner` |
| `panditsuggest_app` | yes | nothing | table DML + function EXECUTE, least privilege |
| `panditsuggest_readonly` | yes | nothing | `SELECT` only, `default_transaction_read_only` |

None has `SUPERUSER` or `BYPASSRLS`. The RDS master account exists for
`tools/00-bootstrap-rds.sql` and emergencies, and is used for nothing else.

### Why the owner cannot log in

Row-Level Security does not apply to a table's owner. The previous model made
that a live hole: the owner was `panditconnect`, a **LOGIN superuser** used for
migrations, ad-hoc scripts *and* the test suite's fixture pool — so a great deal
of ordinary work ran with all 57 policies silently disabled.

The obvious fix is `ALTER TABLE … FORCE ROW LEVEL SECURITY`, and it is the wrong
one here. Forcing RLS subjects the owner to its own policies, and all 14
`SECURITY DEFINER` functions execute *as the owner* — that is their entire
purpose. With FORCE on, `record_qualified_lead()` cannot see the user it is
validating and `auth_find_user_by_email()` cannot find anyone: authentication
and lead recording both fail closed. (Reproduced: test L1 returns
`user_not_found`.)

So the guarantee is structural instead, and stronger: **no session can ever run
as the owner.** `panditsuggest_owner` is `NOLOGIN NOBYPASSRLS`, the migrator
reaches it only through `SET ROLE` for the length of a deployment, and
`verify-schema.sql` fails the build if any application table is owned by a role
that can log in.

---

## 3. Security model

### Row visibility is not column visibility

RLS is row-level. `users_select_public` exposes every `pandit`/`temple_admin`
row to anonymous callers, and `users_select_via_public_content` exposes anyone
who authored published content — which, before this work, meant an anonymous
connection could read **100 % of `users`, including the admin's
`password_hash`** (proven during the audit). The only thing preventing
disclosure was that application queries happened to name their columns.

The fix is column-level privilege (`tools/hardening.sql` H2). The app role holds
`SELECT` on 24 named columns of `users` and not on:

```
password_hash   totp_secret_encrypted   google_id   facebook_id   date_of_birth
```

`INSERT`/`UPDATE` still cover them — signup writes a password hash, MFA enrolment
writes a TOTP secret. Writing a secret you cannot read back is the intended
property.

Postgres rejects `SELECT *` and `RETURNING *` outright when any column is
unreadable, so three queries in `auth.repository.js` name their columns via a
shared `USER_COLUMNS` constant. Credential reads are unaffected: they go through
the `SECURITY DEFINER` `auth_find_user_by_*` functions, which execute as the
owner.

### SECURITY DEFINER

All 14 pin `search_path = public, pg_temp`. The app role has no `CREATE` on
`public`, so the classic definer hijack was not exploitable — but that mitigation
was load-bearing and one careless `GRANT CREATE` from removing it.
`verify-schema.sql` fails if any definer function has `proconfig IS NULL`.

### What the app role cannot do

- read any credential column of `users`
- `DELETE` from `qualified_leads` (leads are business records)
- `DELETE`/`UPDATE` `ai_query_analytics` (verbatim user questions, now behind RLS)
- write `distribution_config` or `plan_market_entitlements` (read-only; changes
  go through audited `SECURITY DEFINER` setters)
- `UPDATE`/`DELETE` the audit logs (append-only at the grant level)

---

## 4. Business invariants, enforced structurally

Things that were previously true only because the application happened to do
them in the right order.

**Payments**

```
UNIQUE (gateway_payment_id) WHERE NOT NULL      duplicate webhook -> duplicate row
UNIQUE (gateway_order_id)   WHERE NOT NULL
UNIQUE (pandit_id)          WHERE is_active     two active subscriptions at once
CHECK  (refund_amount <= amount)
CHECK  (status <> 'completed' OR paid_at IS NOT NULL)
```

The "one active subscription" index required reordering both activation call
sites to deactivate the outgoing entitlement *before* activating the incoming
one — a unique index is checked per statement, not per transaction.

**`activate_pandit_subscription()`** was `SECURITY DEFINER` with zero validation
and an unconditional seat-cap override: anything reaching it granted an unlimited
free `diamond` tier. It now refuses unless an active `pandit_subscriptions` row
exists whose plan tier and expiry match what is being written, backed by either a
`completed` payment or an explicitly-recorded `manual` admin grant — plus an
expiry that is in the future and inside a 10-year ceiling. The success path is
otherwise unchanged, and the seat-cap override is retained deliberately (capacity
is enforced at purchase time; removing it would block legitimately-paid renewals
into a full tier).

**Leads.** Deliberately not rewritten. `record_qualified_lead()` is the model the
rest of the schema should follow — it re-validates every invariant internally,
takes an advisory lock scoped to the exact `(pandit, user)` pair, and derives
market from the *verified* phone rather than from a caller argument. The problem
was never its logic; it was that four historical migrations each restated the
whole body, so the effective definition depended on file ordering. The baseline
carries exactly one canonical copy, and `verify-schema.sql` fails if a second
definition or a different arity ever appears.

---

## 5. Test isolation

The single most urgent finding: a test run had already put 633 fixture rows into
the live database, and the mechanism was still open. `testDbGuard` returned early
unless `NODE_ENV === 'test'`, and nine `npm run test:*` scripts did not set it.

Four layers now, the first three of which are string checks on the connection
string and therefore fire before a socket opens:

1. `NODE_ENV=test` **and** `DATABASE_ENV=test`, both explicit — absence is not
   consent, and the guard detects a test runner on its own (`node --test`,
   `npm_lifecycle_event`, `*.test.js` in argv) rather than trusting the caller
2. the host must not match `*.rds.amazonaws.com` or `amazonaws.com`, whatever the
   database is called
3. the database must be `panditconnect_test`
4. after connect: the `deployment_environment` marker must not say `production`
   or `staging` — this travels with the data, so a restored production snapshot
   is still recognisable under any name

All twelve test scripts now set both markers, CI asserts they do, and the
production-superuser fallbacks in `config/db.js` and `tests/helpers.js` are gone.

The same reasoning covers `drop.js`, `run-wipe*.js` and `reset-admin.js`, which
resolve from `DATABASE_URL` — after cutover that *is* production.
`src/config/destructiveGuard.js` refuses a managed endpoint or a production
database name outright, and requires `ALLOW_DESTRUCTIVE=yes` otherwise.

---

## 6. Connections

```
max                                  10 per instance   (explicit, was default)
connectionTimeoutMillis            5 000              (was 0 = hang forever)
statement_timeout                 30 000              (server default is 0)
idle_in_transaction_session_timeout 60 000
lock_timeout                       5 000
keepAlive                          on                 (RDS/NAT idle reaping)
application_name                   panditsuggest-api
ssl                                CA-verified, RDS only
```

Worst case at 4 backend instances during a rolling deploy: 4 × 10 × 2 = 80,
plus the migrator and a couple of psql sessions, against `max_connections ≈ 100`.
That fits; **5 instances does not.** RDS Proxy is not justified yet — revisit
above 4 instances or if Lambda is introduced.

TLS uses `rejectUnauthorized: true` with the RDS CA bundle. `rejectUnauthorized:
false` encrypts the traffic and authenticates nothing, which is worse than
useless. If the bundle is missing the process refuses to start rather than
falling back to an unverified session.

---

## 6a. The service catalogue is NOT config — a correction

`config/0001-production-config.sql` originally shipped 32 services, 4 categories
and 22 AI problem->service mappings, on the reasoning that a catalogue of real
Hindu rituals is reference data rather than demo content.

That reasoning was wrong, and the check that would have caught it was never run:
the service **names** are real rituals, but the **descriptions** are scrambled
`02-seed.sql` placeholder text. Three services shared one identical description,
and `Antim Sanskar` — the funeral rite — was described as "the baby's first rice
ceremony". The imagery was one placeholder portrait repeated on every card.

`migrations/0003-remove-demo-service-catalogue.sql` removes all three tables'
rows. Production now starts with an empty catalogue, exactly as it starts with
zero pandits and zero temples; real services are added through the admin panel.

`ai_problem_categories` (43 rows) is deliberately KEPT: that taxonomy is
coherent, has Hindi names and a parent hierarchy, is not user-visible, and is
what a future real catalogue gets mapped onto.

**The general lesson**, which applies to anything else promoted out of
`02-seed.sql`: "the names look real" is not evidence that the rows are real.
Check the field a user would actually read.

## 7. What is deliberately still true

- **Single-AZ to start**, per the cost decision. This does not meet the 2-hour
  RTO on an AZ failure by itself; see `AWS_RDS_RUNBOOK.md` for the trigger to
  switch on Multi-AZ, which is a one-click change with no schema impact.
- **`ai_query_analytics` retains its rows indefinitely.** RLS and grants are
  fixed, but `query_text` holds verbatim user questions and should expire at
  ~90 days. Not implemented; needs a retention job.
- **Schedulers run on every backend instance** with no leader election. Safe
  today (`revert_expired_pandit_tiers()` is self-limiting; reminders are behind a
  unique constraint), but it is duplicated work at N instances.
- **`home_hero_images.gallery`** existed in production, in no migration, and in
  no application code. It is excluded from the baseline. If anything turns out to
  need it, add it as a migration.

---

## 8. See also

- `docs/MIGRATION_RULES.md` — how to change the schema
- `docs/PRODUCTION_DB_RUNBOOK.md` — the cutover sequence
- `docs/DATABASE_BACKUP_RESTORE.md` — backup and proven restore
- `docs/AWS_RDS_RUNBOOK.md` — instance settings, scaling triggers, emergencies
- `docs/DB_PRODUCTION_AUDIT.md` — the evidence this design is a response to
