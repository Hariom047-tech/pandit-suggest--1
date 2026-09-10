# Migration Rules

The rules are short. The reasons are not, so they are included — a rule whose
reason is forgotten gets worked around the first time it is inconvenient.

---

## The rules

1. **An applied migration is immutable.** Never edit a file that has run in
   production. Fix forward in a new one.
2. **Numbers are 4-digit and never reused.** `0003`, `0004`, … The next number
   is one above the highest in `migrations/`.
3. **Migrations never manage their own transactions.** No `BEGIN`, no `COMMIT`.
   The runner owns that.
4. **Every migration ends in a self-check** that raises if it did not achieve
   what it claims.
5. **`historical/` is read-only, permanently.** Nothing runs it, nothing edits it.
6. **The baseline is generated, not written.** Change `tools/hardening.sql` and
   re-run `tools/build-baseline.sh`.
7. **Expand/contract for anything destructive.** See below.

---

## Why immutability

The runner records a SHA-256 of each file's bytes. On every deployment it
recomputes them and compares.

```
applied, checksum matches   -> skip
applied, checksum differs   -> ABORT the whole deployment
not applied                 -> BEGIN; run; verify; record; COMMIT
```

Editing `0007` after it has run in production does not change production. It
creates two different schemas that both claim to be version `0007`: the one
production actually has, and the one every future environment will build. They
diverge silently and forever, and you find out months later when a query works
in staging and fails in production.

The checksum comparison happens over the **whole set** before anything is
applied, so a tampered `0007` stops the deployment even when only `0009` is
pending. CI enforces the same rule at the source level — a PR that modifies any
file in `migrations/`, `baseline/` or `config/` that already exists on `main`
fails.

```
BAD   edit 0007-add-column.sql to also add a second column
GOOD  add 0008-add-second-column.sql
```

---

## Writing one

```sql
-- ============================================================================
-- 0003 — <what and why, in one line>
-- ============================================================================
-- What problem this solves, and what it does NOT solve. If it is reversing an
-- earlier decision, say which and why that decision was reasonable at the time.
-- ============================================================================

ALTER TABLE public.pandits ADD COLUMN IF NOT EXISTS foo TEXT;

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='pandits'
                    AND column_name='foo') THEN
    RAISE EXCEPTION 'Migration 0003 incomplete — pandits.foo missing';
  END IF;
  RAISE NOTICE 'Migration 0003 applied: pandits.foo added.';
END
$verify$;
```

Schema-qualify everything (`public.pandits`, not `pandits`). The baseline is a
`pg_dump`, and pg_dump's preamble sets `search_path = ''` **session-wide**. The
runner resets it after every file, but qualifying costs nothing and does not
depend on the runner getting that right.

### When a transaction is impossible

`CREATE INDEX CONCURRENTLY` and `ALTER TYPE … ADD VALUE` cannot run inside a
transaction block. Put this on **line 1**:

```sql
-- migrate:no-transaction
```

The runner then sends the file one statement at a time, so each gets its own
implicit transaction. (node-pg sends a multi-statement string as a single
simple-query message, and PostgreSQL wraps *that* in an implicit transaction —
which is exactly what `CONCURRENTLY` refuses.)

Such a file is **not atomic**. It may half-apply. So:

- every statement must be `IF NOT EXISTS` / idempotent
- the self-check must also catch the half-applied state

A failed `CONCURRENTLY` build leaves an **INVALID** index that exists but is
never used — which passes a naive existence check. Check for it:

```sql
SELECT c.relname FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
 WHERE NOT i.indisvalid;
-- then: DROP INDEX CONCURRENTLY <name>;  before retrying
```

`0002-fk-supporting-indexes.sql` is the worked example.

---

## Expand / contract

Online migrations, in order of how much they hurt.

| Safe now | Needs the full dance |
|---|---|
| add a nullable column | rename a column |
| `CREATE INDEX CONCURRENTLY` | drop a column |
| add a table | change a column's type |
| `ADD CONSTRAINT … NOT VALID` then `VALIDATE` | `SET NOT NULL` on a populated table |
| add an enum value (not used in the same txn) | drop or rename an enum value |
| backfill in batches | one large `UPDATE` |

A rename is three releases, never one:

1. **Expand** — add the new column, write both, read the old
2. **Migrate** — backfill in batches; switch reads to the new column
3. **Contract** — a release later, once nothing reads it, drop the old column

The reason is deploy overlap: during a rolling deploy, old and new application
code run at the same time against one database. A migration that renames a column
in a single release breaks every old instance still serving traffic.

`SET NOT NULL` on a populated table takes `ACCESS EXCLUSIVE` and scans the whole
table. Instead:

```sql
ALTER TABLE t ADD CONSTRAINT t_foo_not_null CHECK (foo IS NOT NULL) NOT VALID;
-- later, in a separate migration — takes only SHARE UPDATE EXCLUSIVE:
ALTER TABLE t VALIDATE CONSTRAINT t_foo_not_null;
```

Backfills go in batches with a bounded lock:

```sql
SET lock_timeout = '5s';
-- UPDATE ... WHERE id IN (SELECT id FROM t WHERE foo IS NULL LIMIT 1000)
```

The runner already sets `lock_timeout = 10s` and `statement_timeout = 15min` for
the session and re-asserts them after every file, because a `pg_dump`-produced
migration resets both to `0` (unlimited) session-wide. Without that, one
migration could block the live site indefinitely instead of failing fast.

---

## Rollback

**Do not write DOWN migrations.** They are written when the schema is calm and
run when it is not, they are almost never tested, and for anything that touched
data they are a lie.

| Change | Recovery |
|---|---|
| additive (column, table, index) | forward-fix; usually nothing to undo |
| function replacement | a new migration restoring the previous body |
| RLS / grant change | forward-fix, immediately |
| backfill or repair | **not reversible** — snapshot first, PITR if it goes wrong |
| destructive DDL | expand/contract across ≥3 releases; recovery is PITR |

**Take a manual RDS snapshot before any migration that is not purely additive**,
tagged with the release id. That is the actual rollback plan.

Application rollback is cheap and stays cheap as long as migrations are
backward-compatible with the previous release — which is what expand/contract
buys.

---

## What CI enforces

On every PR touching the database:

- an empty PostgreSQL builds cleanly from `baseline -> config -> migrations`
- re-running the migrator is a no-op
- `verify-schema.sql` passes (function bodies re-validate with
  `check_function_bodies=on`, definer functions pin `search_path`, no login role
  owns a table, the app role cannot read a credential column, lead and payment
  invariants exist, zero business data)
- the lead and payment behavioural tests pass
- the **upgrade** path from `main` produces a schema whose fingerprint is
  **identical** to a fresh install
- no already-released migration was modified
- `historical/` was not modified
- every `npm test` script sets `NODE_ENV=test` and `DATABASE_ENV=test`
- the test guard refuses an RDS endpoint
- no credential appears in `baseline/` or `config/`

Both fresh install and upgrade, every time. A migration that only works on one
path is the classic way production and CI drift apart.
