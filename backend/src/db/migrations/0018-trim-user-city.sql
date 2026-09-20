-- ============================================================================
-- 0018 — trim the whitespace off hand-entered city and state
-- ============================================================================
-- The live data carries both "Nalkheda" and "Nalkheda " — one town, typed
-- twice, with a trailing space nobody can see in an admin form. Postgres
-- compares them as different strings, and everything downstream inherits
-- that split:
--
--   * the city filter on /pandits is built from `new Set(p.city)`, so the
--     same town appears as two checkboxes, each with a partial count (7 and
--     3 at the time of writing);
--   * "similar pandits" on a profile matches on `x.city === p.city`, so a
--     pandit only ever saw the half of the town that shared their spelling;
--   * any future GROUP BY city splits the same way.
--
-- The frontend now trims at its normalisation boundary (normalize.ts), which
-- fixes what a devotee sees today, but the column stays dirty underneath and
-- every new consumer — an export, a report, a backend query — starts out
-- exposed to it again. This cleans the source.
--
-- Idempotent: re-running it matches nothing, because the WHERE only selects
-- rows that still differ from their trimmed form.

UPDATE users
   SET city = btrim(city)
 WHERE city IS NOT NULL
   AND city <> btrim(city);

UPDATE users
   SET state = btrim(state)
 WHERE state IS NOT NULL
   AND state <> btrim(state);

UPDATE temples
   SET city = btrim(city)
 WHERE city IS NOT NULL
   AND city <> btrim(city);
