# AWS RDS Runbook

Operating the production database: settings, monitoring, scaling triggers and
emergencies. For the one-time cutover see `PRODUCTION_DB_RUNBOOK.md`.

**Account** 376834080419 · **Region** ap-south-1 (Mumbai)

---

## 1. Required configuration

| Setting | Value | Why it is not optional |
|---|---|---|
| `PubliclyAccessible` | **false** | |
| Subnets | private only | no route to an internet gateway |
| Security group | TCP 5432 from the **backend EC2 SG id** | not a CIDR — instances change addresses |
| `StorageEncrypted` | true (KMS) | covers instance, automated backups, every snapshot |
| `rds.force_ssl` | **1** | otherwise a client can silently negotiate plaintext |
| `DeletionProtection` | true | |
| `BackupRetentionPeriod` | >= 14 | non-zero is what enables PITR |
| Storage autoscaling | on | the previous host filled its disk to 90 % |
| `log_min_duration_statement` | 1000 | there is currently no slow-query logging at all |
| Engine | PostgreSQL 16, with `vector` >= 0.8 | the AI HNSW index depends on it |

Admin access is via **SSM Session Manager port-forward**. No bastion host, no
public endpoint, ever:

```bash
aws ssm start-session --region ap-south-1 \
  --target <backend-instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["<rds-endpoint>"],"portNumber":["5432"],"localPortNumber":["5432"]}'
```

## 2. Roles and secrets

| Role | Login | Used by | Secret |
|---|---|---|---|
| `panditsuggest_owner` | **no** | nothing — `SET ROLE` only | none, deliberately |
| `panditsuggest_migrator` | yes | deployments, CI | `panditsuggest/rds/migrator` |
| `panditsuggest_app` | yes | the backend | `panditsuggest/rds/app` |
| `panditsuggest_readonly` | yes | dashboards, on-call | `panditsuggest/rds/readonly` |
| RDS master | yes | bootstrap + emergencies only | `panditsuggest/rds/master` |

The EC2 instance role reads **only** `panditsuggest/rds/app`. The migrator
credential belongs to the deployment pipeline, not to the running application —
a compromised web process must not be able to alter the schema.

No production password appears in git. The dev placeholders in
`docker-compose.yml` and `tools/00-bootstrap-dev.sql` match a database that only
exists inside `docker compose` and are worth nothing.

> **Outstanding:** the EC2 role (`PanditSuggestEC2MediaRole`) currently has S3
> media permissions only. It needs `secretsmanager:GetSecretValue` scoped to
> `panditsuggest/rds/app-*` before cutover, and nothing broader.

**Rotation.** Enable RDS-managed rotation on the app credential once traffic is
steady. Rotating requires a backend restart to pick up the new value; do it in a
maintenance window until the app re-reads the secret on connection failure.

## 3. Scaling triggers

Start small on purpose. Each of these is a **measured** trigger, not a schedule
— the current dataset is 29 MB with zero real business rows.

| Change | Trigger |
|---|---|
| `db.t4g.small` → `db.t4g.medium` | CPU > 70 % sustained 30 min, **or** `FreeableMemory` < 15 %, **or** CPU credit balance trending to zero |
| Single-AZ → **Multi-AZ** | the first month where losing 1–2 h of availability costs real revenue, **or** any paying pandit depends on lead delivery. This is a one-click change with no schema impact and roughly doubles cost |
| Storage | autoscaling handles it; alarm at 20 % free |
| Read replica | read-heavy load from analytics/dashboards competing with the request path |
| **RDS Proxy** | above ~4 backend instances, or if Lambda is introduced. See the connection budget below — do not add it before then |
| Aurora | read-replica scale or multi-region. Not now: the dataset is tiny and Aurora buys nothing that justifies the cost |

### Connection budget

`max_connections` on `db.t4g.small` is ~100.

```
backend x 1 instance                    10
backend x 4 instances                   40
+ rolling deploy overlap (old + new)    80
+ migrator                               1
+ psql / scripts                        ~5
------------------------------------------
peak during a rolling deploy of 4      ~86 of 100
```

Four instances fits. **Five does not** — that is the RDS Proxy trigger, not a
guess about traffic.

## 4. Monitoring

Enable Performance Insights (7-day retention is free).

| Alarm | Threshold |
|---|---|
| CPU | > 80 % for 10 min |
| `FreeStorageSpace` | < 20 % |
| `DatabaseConnections` | > 70 % of max |
| `FreeableMemory` | < 15 % |
| Deadlocks | > 0 |
| Transaction open | > 5 min |
| Failed connections | any spike |
| CPU credit balance (t4g) | trending to zero |

Every one of these thresholds is an assumption until there is real traffic.
Revisit after the first month with actual numbers.

## 5. Daily assertions

Non-destructive, run as `panditsuggest_readonly`. Each has a known-correct
answer; alert on any deviation.

```sql
-- 1. no test data, ever again
SELECT count(*) FROM users
 WHERE email LIKE '%@test.local' OR email LIKE '%@panditsuggest.test'
    OR email LIKE '%@panditconnect.demo' OR email LIKE '%@example.com';   -- 0

-- 2. no unexpected admins
SELECT count(*) FROM users WHERE role IN ('admin','super_admin');         -- known N

-- 3. RLS still enabled
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity;         -- >= 16

-- 4. policies intact
SELECT count(*) FROM pg_policies WHERE schemaname='public';               -- 58

-- 5. no login role owns an application table
SELECT count(*) FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_roles r ON r.oid=c.relowner
 WHERE n.nspname='public' AND c.relkind='r' AND r.rolcanlogin
   AND c.relname <> 'schema_migrations';                                  -- 0

-- 6. every SECURITY DEFINER function still pins search_path
SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef AND p.proconfig IS NULL;        -- 0

-- 7. one active subscription per pandit
SELECT count(*) FROM (SELECT pandit_id FROM pandit_subscriptions
  WHERE is_active GROUP BY pandit_id HAVING count(*)>1) x;                -- 0

-- 8. no paid tier without a payment
SELECT count(*) FROM pandits p WHERE p.current_tier <> 'free'
  AND NOT EXISTS (SELECT 1 FROM payment_transactions t
    WHERE t.pandit_id=p.id AND t.status='completed');                     -- investigate any

-- 9. lead invariant
SELECT count(*) FROM qualified_leads WHERE market IS NULL;                -- 0

-- 10. the ledger matches the files on disk
SELECT version, checksum FROM schema_migrations ORDER BY version;
```

`tools/verify-schema.sql` covers 3–6 and 9 and can be run against production
read-only at any time.

---

## 6. Emergencies

**Suspected compromise.** Rotate every credential in Secrets Manager; revoke
`LOGIN` from `panditsuggest_app` to stop the bleeding
(`ALTER ROLE panditsuggest_app NOLOGIN;` — the site goes down, deliberately);
snapshot immediately for forensics; review `security_audit_log` and
`admin_activity_log`, which are append-only at the grant level and so are
trustworthy; check assertion 2 above for admins you did not create.

**Runaway query.** `panditsuggest_app` has `statement_timeout = 30s`, so an
application query cannot run away. If something does:

```sql
SELECT pid, now()-query_start AS age, left(query,80)
  FROM pg_stat_activity WHERE state='active' ORDER BY query_start;
SELECT pg_cancel_backend(<pid>);      -- try this first
SELECT pg_terminate_backend(<pid>);   -- then this
```

**Connection exhaustion.** Check `application_name` in `pg_stat_activity` to
identify the source — that is what it is set for. Likely a deploy that did not
drain, or a script left running.

**Storage full.** Autoscaling should prevent it. If not, `modify-db-instance
--allocated-storage`, which is online. Then find the growth: almost certainly
`pandit_exposure` or `user_activity_events`.

**Data damage.** PITR to a point before it, into a **new** instance. Never
restore over production. `DATABASE_BACKUP_RESTORE.md` §3–4.

**AZ failure, single-AZ.** This is a restore, not a failover — 20–60 minutes plus
config. If that is unacceptable, the answer is Multi-AZ (§3), not a faster
restore.
