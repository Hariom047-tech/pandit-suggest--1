# Production Database Runbook — RDS Cutover

**Do not execute any of this until the acceptance gates in §0 all pass.**
Steps 1–13 are read-only or affect only the new, empty RDS instance. **Step 14
is the point of no return** — it is where live traffic moves. Everything before
it is reversible by deleting the RDS instance and walking away.

---

## 0. Gates

Every one of these must be green. Most are proven by
`.github/workflows/database.yml`; the rest are one-off.

```
[x] off-host backup of the old database exists, with checksum
[x] that backup restores into a disposable database
[x] fresh scratch DB A builds from zero and verifies
[x] fresh scratch DB B builds from zero and verifies
[x] A and B schema fingerprints are identical
[x] migration ledger records every applied file
[x] editing an applied migration ABORTS the deployment
[x] a second concurrent migrator REFUSES to run
[x] the test suite cannot reach an RDS endpoint
[x] baseline + config create zero business data
[x] lead distribution tests pass (9)
[x] payment / subscription tests pass (9)
[x] RLS + credential-exposure tests pass
[x] app role has least privilege and cannot read credentials
[x] upgrade path == fresh install
[ ] RDS instance exists, is private, and is reachable from the backend EC2   <- verify on the day
[ ] RDS offers pgvector >= 0.8 and PostGIS                                    <- verify on the day
[ ] automated backups, PITR, deletion protection, encryption all ON           <- verify on the day
[ ] a restore from an RDS snapshot has been proven                            <- do on the day
[ ] super-admin bootstrap completed and MFA enrolled
```

---

## 1. Verify the instance

```bash
aws rds describe-db-instances --region ap-south-1 \
  --db-instance-identifier <instance-id> \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Engine:EngineVersion,
           Public:PubliclyAccessible,Encrypted:StorageEncrypted,
           DeletionProtection:DeletionProtection,Backups:BackupRetentionPeriod,
           MultiAZ:MultiAZ,Class:DBInstanceClass}'
```

Required: `Status=available`, `Public=false`, `Encrypted=true`,
`DeletionProtection=true`, `Backups>=7`.

**If `Public` is `true`, stop.** Fix it before anything else.

## 2. Verify the security group

```bash
aws ec2 describe-security-groups --region ap-south-1 --group-ids <rds-sg> \
  --query 'SecurityGroups[0].IpPermissions'
```

Exactly one rule: TCP 5432, source = the **backend EC2 security group id**, not
a CIDR. No `0.0.0.0/0`, on any port.

## 3. Verify private connectivity, from the backend EC2

```bash
# on the backend host
nc -zv <rds-endpoint> 5432
```

Must succeed from the backend host and fail from anywhere else.

## 4. Verify TLS

```bash
curl -o certs/rds-global-bundle.pem \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

PGSSLMODE=verify-full PGSSLROOTCERT=certs/rds-global-bundle.pem \
  psql "host=<rds-endpoint> port=5432 dbname=postgres user=<master>" \
  -c "SELECT ssl, version FROM pg_stat_ssl JOIN pg_stat_activity USING (pid)
      WHERE pid = pg_backend_pid();"
```

`ssl` must be `t`. If `verify-full` fails, the CA bundle is wrong — do not
downgrade to `require`.

## 5. Confirm the extensions are available

```sql
SELECT name, default_version FROM pg_available_extensions
 WHERE name IN ('postgis','vector','pgcrypto','pg_trgm','btree_gin','unaccent');
```

**`vector` must be >= 0.8** — the AI HNSW index depends on it. If the target
minor ships less, stop and pick a different engine version; this is not something
to work around at cutover.

## 6. Create the database and bootstrap it (as the RDS master)

The master account is used here and never again except in emergencies.

```bash
psql "$MASTER_URL" -c "CREATE DATABASE panditsuggest;"

psql "$MASTER_URL_DB" -v ON_ERROR_STOP=1 -v dbname=panditsuggest \
  -f backend/src/db/tools/00-bootstrap-rds.sql
```

This creates the extensions (master-only), the four roles (NOLOGIN, no
passwords), transfers ownership of `public` to `panditsuggest_owner`, revokes
`CREATE` on `public` from `PUBLIC`, and sets the per-role timeouts. It ends in a
self-check.

## 7. Generate credentials into Secrets Manager

Passwords are generated here and never typed, echoed, committed, or pasted into
a ticket.

```bash
for role in migrator app readonly; do
  aws secretsmanager create-secret \
    --region ap-south-1 \
    --name "panditsuggest/rds/$role" \
    --generate-secret-string '{"PasswordLength":40,"ExcludePunctuation":true}' \
    --description "PanditSuggest RDS credential: panditsuggest_$role"
done
```

Then grant each role `LOGIN` with its generated password, reading it straight
from Secrets Manager so it never lands in shell history:

```bash
for role in migrator app readonly; do
  pw=$(aws secretsmanager get-secret-value --region ap-south-1 \
        --secret-id "panditsuggest/rds/$role" --query SecretString --output text)
  psql "$MASTER_URL_DB" -q -c \
    "ALTER ROLE panditsuggest_$role LOGIN PASSWORD '$(printf %s "$pw" | sed "s/'/''/g")';"
done
unset pw
```

`panditsuggest_owner` stays `NOLOGIN`. It gets no password because nothing may
ever authenticate as it.

## 8. Apply the baseline, config and migrations

```bash
cd backend
export DATABASE_MIGRATOR_URL="postgresql://panditsuggest_migrator:<from-secrets>@<endpoint>:5432/panditsuggest?sslmode=verify-full"
export DEPLOYMENT_ID="cutover-$(date -u +%Y%m%dT%H%M%SZ)"
export RDS_CA_BUNDLE=../certs/rds-global-bundle.pem

node scripts/migrate.js --dry-run    # read it before you run it
node scripts/migrate.js
```

Expected: `0000`, `0001`, `0002` applied, ledger written, advisory lock released.

## 9. Verify the schema

```bash
psql "$DATABASE_MIGRATOR_URL" -v ON_ERROR_STOP=1 \
  -f src/db/tools/verify-schema.sql
```

All six `verify:` notices must appear and the script must exit 0.

## 10. Mark the environment

This is what makes the test guard's fourth layer work, and it is why a restored
production snapshot can never be mistaken for a scratch database.

```sql
INSERT INTO public.deployment_environment (environment, note)
VALUES ('production', 'RDS cutover <date>')
ON CONFLICT (id) DO UPDATE SET environment = 'production';
```

## 11. Create the super-admin

Interactive, on the backend host, once. The password is typed with echo off and
is never written to disk, logged, or printed.

```bash
DATABASE_MIGRATOR_URL=... node scripts/bootstrap-superadmin.js
```

Creates `patidarhariom047@gmail.com` (Hariom Patidar, `super_admin`, active) with
a fresh hash, `totp_enabled = false` and `totp_secret_encrypted = NULL`, so the
first admin login forces a fresh MFA enrolment. No legacy session, reset token,
OTP challenge or MFA secret is carried over. The script refuses to run if the
database already holds any user.

## 12. Assert zero test data

```bash
psql "$DATABASE_MIGRATOR_URL" -v ON_ERROR_STOP=1 -f src/db/tools/verify-schema.sql
```

Expect `verify: zero business data, 1 user(s) present`.

## 13. Snapshot and prove the restore

**Before any traffic touches it.**

```bash
aws rds create-db-snapshot --region ap-south-1 \
  --db-instance-identifier <instance-id> \
  --db-snapshot-identifier clean-baseline-t0
```

Then restore that snapshot to a temporary instance and run `verify-schema.sql`
against it. See `DATABASE_BACKUP_RESTORE.md` §4. **A backup that has never been
restored is not a backup**, and this is the cheapest moment in the system's life
to find that out.

---

## 14. Cutover — the point of no return

> **Everything above is reversible. This is not.** Do it in a low-traffic window
> with someone else watching, and read §15 before you start so the rollback is
> already in your head.

Store the app credential where the backend reads it:

```bash
aws secretsmanager get-secret-value --region ap-south-1 \
  --secret-id panditsuggest/rds/app --query SecretString --output text
```

Grant the EC2 role permission to read exactly these secrets and nothing else:

```json
{
  "Effect": "Allow",
  "Action": "secretsmanager:GetSecretValue",
  "Resource": "arn:aws:secretsmanager:ap-south-1:376834080419:secret:panditsuggest/rds/app-*"
}
```

Update `DATABASE_URL` for the backend to the RDS endpoint as
`panditsuggest_app`, with `sslmode=verify-full`, and restart **one** instance:

```bash
docker compose up -d --no-deps backend
```

## 15. Verify, in this order

Stop and roll back at the first failure.

```
[ ] GET /api/health returns 200
[ ] admin login -> TOTP enrolment completes
[ ] pandit directory lists (empty is correct — there are no pandits yet)
[ ] temple / service browsing renders EMPTY (0 services, 0 temples, 0 pandits)
    — the demo catalogue was removed by migration 0003; real content is
      added through the admin panel
[ ] OTP request reaches WhatsApp; login completes
[ ] Google sign-in completes
[ ] a contact click records a qualified lead (check qualified_leads)
[ ] lead counts appear on the pandit dashboard
[ ] market/geo behaviour: an Indian phone yields market=INDIA
[ ] Razorpay order creation returns an order id
[ ] AI chat answers (pgvector query path)
[ ] site content APIs (FAQs, hero images, site images)
[ ] no errors in the backend log
[ ] pg_stat_activity shows application_name=panditsuggest-api and <=10 connections
```

**Rollback, any time before you are satisfied:** put `DATABASE_URL` back to the
Docker Postgres and restart the backend. The old database is still running,
untouched, and still has every row. That is the entire rollback, and it stays
available for the safety period in §16.

## 16. After

- Leave the old Docker Postgres **running and untouched** for at least 14 days.
  Do not dual-write. All new data goes only to RDS.
- Enable Performance Insights and CloudWatch alarms (`AWS_RDS_RUNBOOK.md` §4).
- Set `log_min_duration_statement = 1000` — there is currently no slow-query
  logging at all.
- Schedule the daily assertions in `AWS_RDS_RUNBOOK.md` §5.
- Only after a successful restore drill *from RDS* should the old database be
  decommissioned — and keep a final `pg_dump` of it in S3 regardless.

---

## Emergencies

**The app cannot connect.** Check the SG first (source must be the backend SG,
not a CIDR), then that `DATABASE_URL` uses `panditsuggest_app` and not the
master, then that the CA bundle exists at `RDS_CA_BUNDLE`. The backend refuses to
start rather than connecting without CA verification — that is deliberate.

**A migration failed halfway.** Transactional migrations rolled back; nothing to
do but fix and re-run. A `-- migrate:no-transaction` file did not — read its
header, check for INVALID indexes, then re-run. Never edit the failed file; if
its content was wrong, revert it and add a new version.

**Two deploys collided.** The second one refused and stopped. That is correct.
Re-run it after the first finishes.

**Something is badly wrong with the data.** PITR to a point before it, into a
**new** instance — never restore over production. `DATABASE_BACKUP_RESTORE.md` §3.
