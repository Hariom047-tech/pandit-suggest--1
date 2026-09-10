# Database Backup and Restore

**Targets:** RPO ≤ 5 minutes, RTO ≤ 2 hours.

A backup that has never been restored is not a backup. Every procedure here
ends in a verification step, and §4 is mandatory before go-live.

---

## 1. Current state

### The old (pre-cutover) database

Taken 2026-09-07, on the EC2 host, from the live `panditconnect-db` container.

| | |
|---|---|
| Location | `/home/ec2-user/db-backups/` (gitignored) |
| Timestamp | `20260907T080823Z` |
| Server | PostgreSQL 16.15 |
| Database size | 29 MB |
| Schema-only | `panditconnect-schema-20260907T080823Z.sql` (190 KB) |
| Full, custom format | `panditconnect-full-20260907T080823Z.dump` (958 KB) |
| Full, plain + gzip | `panditconnect-full-20260907T080823Z.sql.gz` (389 KB) |
| Checksums | `SHA256SUMS-20260907T080823Z.txt` |

```
5686e1a6fff980de83c9d04f6a0d45a86e6beb97031c8661b83f5b932abff4f3  ...full....dump
a2ce701a704df3bd3dfd2acec12fce2db558f04cba81e8a569fd9ea7c8a8b9d4  ...full....sql.gz
19942a98961346893eedd8cae1108f7e2a165cc984c654dc855f27005282b8d5  ...schema....sql
```

**Restore verified**, not merely asserted: restored into a disposable database
and reconciled against the live one —

```
tables=70  users=638  pandits=461  qualified_leads=118
payments=44  policies=57  security_definer_functions=14
```

— identical on both sides.

> ### Open item: this backup is still on the same host
>
> "Off-host" is not yet satisfied. The EC2 instance role
> (`PanditSuggestEC2MediaRole`) has S3 permissions scoped to
> `panditsuggest-media-prod` and nothing else — no `ListAllMyBuckets`, no
> `CreateBucket`, no Secrets Manager, no RDS.
>
> **The media bucket must not be used.** It sits behind CloudFront and serves
> public assets; a database dump placed there is a public download of every
> user record in the system.
>
> Closing this needs one of:
> 1. a new **private, encrypted, versioned** bucket (e.g.
>    `panditsuggest-db-backups`) with public access blocked, plus a scoped
>    `s3:PutObject` grant to the instance role — then run the upload in §2; or
> 2. pulling the three files off the host manually over SSH.
>
> Until then the only copy of the old database lives on a single EBS volume on a
> host that has been ~90 % full.

### The new (RDS) database

Managed by AWS. See §3.

---

## 2. Taking a logical backup

```bash
BK=/home/ec2-user/db-backups
TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p $BK

# schema only — small, readable, diffable
docker exec panditconnect-db pg_dump -U panditconnect -d panditconnect \
  --schema-only --no-owner --no-privileges > $BK/panditconnect-schema-$TS.sql

# full, custom format — the one you restore from (parallel, selective)
docker exec panditconnect-db pg_dump -U panditconnect -d panditconnect \
  -Fc -Z6 > $BK/panditconnect-full-$TS.dump

cd $BK && sha256sum panditconnect-*-$TS.* > SHA256SUMS-$TS.txt
```

Against RDS, the same commands with `pg_dump "$DATABASE_MIGRATOR_URL"`.

Then get it off the host:

```bash
aws s3 cp $BK/panditconnect-full-$TS.dump \
  s3://panditsuggest-db-backups/logical/ \
  --region ap-south-1 --sse aws:kms
aws s3 cp $BK/SHA256SUMS-$TS.txt s3://panditsuggest-db-backups/logical/
```

## 2b. Verifying one (do this every time)

```bash
# 1. checksum
cd $BK && sha256sum -c SHA256SUMS-$TS.txt

# 2. the archive is readable and complete
docker exec -i panditconnect-db pg_restore --list < panditconnect-full-$TS.dump | head

# 3. it actually restores
docker exec panditconnect-db psql -U panditconnect -d postgres \
  -c "DROP DATABASE IF EXISTS restore_verify;" -c "CREATE DATABASE restore_verify;"
docker exec -i panditconnect-db pg_restore -U panditconnect -d restore_verify \
  --no-owner --no-privileges < panditconnect-full-$TS.dump

# 4. it reconciles
docker exec panditconnect-db psql -U panditconnect -d restore_verify -tAc "
  SELECT 'tables=' ||(SELECT count(*) FROM information_schema.tables
                       WHERE table_schema='public' AND table_type='BASE TABLE')
      || ' users='  ||(SELECT count(*) FROM users)
      || ' leads='  ||(SELECT count(*) FROM qualified_leads)
      || ' policies='||(SELECT count(*) FROM pg_policies WHERE schemaname='public');"

docker exec panditconnect-db psql -U panditconnect -d postgres -c "DROP DATABASE restore_verify;"
```

Steps 3 and 4 are the ones that matter. 1 and 2 only prove the file is intact,
not that it contains a working database.

---

## 3. RDS: automated backups and PITR

Required settings — verify, do not assume:

| Setting | Value | Why |
|---|---|---|
| `BackupRetentionPeriod` | **>= 14 days** | non-zero is what enables PITR at all |
| Backup window | off-peak IST | |
| `DeletionProtection` | **true** | |
| `StorageEncrypted` | **true** (KMS) | covers the instance, its automated backups and every snapshot |
| Storage autoscaling | on | the old host filled its disk to 90 % |
| `SkipFinalSnapshot` | **false** | |

```bash
aws rds modify-db-instance --region ap-south-1 \
  --db-instance-identifier <id> \
  --backup-retention-period 14 \
  --deletion-protection \
  --apply-immediately
```

**RPO.** PITR replays write-ahead log continuously; recoverable to roughly any
5-minute boundary. That meets RPO ≤ 5 min. It does **not** protect against
something that is faithfully replicated — a bad migration or a mistaken
`DELETE` is captured too, which is why §5 requires a manual snapshot before any
non-additive migration.

**Manual snapshot before risky changes:**

```bash
aws rds create-db-snapshot --region ap-south-1 \
  --db-instance-identifier <id> \
  --db-snapshot-identifier "pre-<release>-$(date -u +%Y%m%d%H%M)"
```

### RTO

Single-AZ, restoring a snapshot to a new instance is typically 20–60 minutes for
a database this size, plus DNS/config. That fits inside 2 hours **provided the
procedure has been rehearsed** — which is what §4 is for. An unrehearsed restore
will not meet a 2-hour RTO, whatever the instance size.

Single-AZ means an AZ failure is a restore, not a failover. See
`AWS_RDS_RUNBOOK.md` §3 for the Multi-AZ trigger.

---

## 4. The restore drill (mandatory before go-live, then quarterly)

**Never restore over production.** Always to a new instance.

```bash
# snapshot -> new instance
aws rds restore-db-instance-from-db-snapshot --region ap-south-1 \
  --db-instance-identifier panditsuggest-restore-test \
  --db-snapshot-identifier clean-baseline-t0 \
  --no-publicly-accessible \
  --db-subnet-group-name <private-subnet-group> \
  --vpc-security-group-ids <rds-sg>

# or PITR -> new instance
aws rds restore-db-instance-to-point-in-time --region ap-south-1 \
  --source-db-instance-identifier <id> \
  --target-db-instance-identifier panditsuggest-pitr-test \
  --restore-time "$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --no-publicly-accessible
```

Then, against the restored instance:

```
[ ] verify-schema.sql passes end to end
[ ] schema fingerprint matches the source
[ ] schema_migrations lists every expected version with matching checksums
[ ] RLS is enabled on >= 16 tables; 58 policies present
[ ] 14 SECURITY DEFINER functions present, all pinning search_path
[ ] record_qualified_lead has exactly one definition, 7-arg signature
[ ] no login role owns an application table
[ ] the app role cannot SELECT users.password_hash
[ ] zero rows matching @test.local / @panditsuggest.test / @panditconnect.demo
[ ] the super-admin exists and is the only user (at T=0)
[ ] payment_transactions reconciles against pandit_subscriptions
[ ] point a backend at it: /health green, one real read path works
```

```bash
# Record the wall-clock time from starting the restore to a green /health.
# That number IS your RTO. Write it down; a target you have not measured is a guess.
aws rds delete-db-instance --region ap-south-1 \
  --db-instance-identifier panditsuggest-restore-test --skip-final-snapshot
```

Repeat quarterly and after any major schema change.

---

## 5. Policy

| Layer | Setting |
|---|---|
| RDS automated backups | 14 days, PITR |
| Manual snapshot | before every non-additive migration, tagged with the release |
| Logical `pg_dump` | weekly to the private encrypted S3 bucket, 90 days |
| Cross-region copy | weekly to ap-southeast-1 **when budget allows** |
| Cross-account copy | when a second account exists (ransomware isolation) |
| Restore drill | before go-live, then quarterly |

**Never auto-delete** `payment_transactions`, `pandit_subscriptions`,
`qualified_leads` or `admin_activity_log`. Payment and accounting records created
after launch are retained long-term.

> Indian statutory retention for accounting records is commonly cited as 8 years
> under the Companies Act. That is **not verified here** and is a question for an
> accountant, not an engineer. Until it is answered, retain indefinitely — the
> data is small and deletion is the irreversible direction.

Retention candidates, none implemented yet, none affecting the records above:
`pandit_exposure` (highest-growth table by far), `user_activity_events`
(90–180 d), `ai_query_analytics.query_text` (90 d — it holds verbatim user
questions), `security_audit_log` (1 year, then archive to S3).
