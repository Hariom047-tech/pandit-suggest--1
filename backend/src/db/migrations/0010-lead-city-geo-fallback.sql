-- ============================================================================
-- 0010 — give a pandit a city on their leads even when the devotee typed none
-- ============================================================================
-- The pandit dashboard's My Leads screen shows "—" for City on almost every
-- lead, and the admin user detail said "Unknown" for the same reason: nothing
-- ever filled users.city, so the value the lead snapshotted was NULL.
--
-- 0007 started recording the CloudFront edge guess in users.geo_city /
-- geo_region at each login, and the admin Users LIST already falls back to it.
-- The leads screen cannot do the same trick, and this is the part worth
-- spelling out: qualified_leads carries contact_city_snapshot precisely
-- because RLS gives a pandit session no SELECT on an arbitrary devotee row —
-- see that column's own comment, and migration 27 which added it after the
-- live JOIN was found to return NULL silently. Adding u.geo_city to the leads
-- query would return NULL for exactly the same reason.
--
-- So the fallback has to be captured at lead-creation time, inside
-- record_qualified_lead(), which is where the existing snapshot is taken.
-- Two surgical changes and nothing else: geo_city/geo_region are read into
-- v_user, and the INSERT stores COALESCE(city, geo_city) instead of city.
-- The function body below is otherwise the deployed definition verbatim.
--
-- What the pandit sees is therefore "the devotee's city if they stated one,
-- else roughly where their phone connected from". For a mobile connection
-- that resolves to the carrier's gateway city, not the caller's village — a
-- devotee in a town outside Indore shows as Indore. That is a useful hint for
-- a pandit deciding whether to take a job and a bad basis for planning
-- travel; the number on the lead is what settles it, and asking is free.
-- Existing leads keep the NULL they were created with: this changes what is
-- captured from now on, not history that was never recorded.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_qualified_lead(p_pandit_id uuid, p_user_id uuid, p_method contact_method, p_dedup_hours integer, p_source character varying DEFAULT NULL::character varying, p_temple_id uuid DEFAULT NULL::uuid, p_service_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(lead_id uuid, was_created boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_user      RECORD;
    v_pandit    RECORD;
    v_existing  RECORD;
    v_new_id    UUID;
    v_country   TEXT;
    v_market    lead_market;
    v_msource   market_source;
BEGIN
    IF p_method NOT IN ('phone_call', 'whatsapp') THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'method_not_qualifying'; RETURN;
    END IF;

    SELECT id, full_name, phone, status, phone_verified, deleted_at, city, state,
           geo_city, geo_region
      INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND OR v_user.deleted_at IS NOT NULL THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'user_not_found'; RETURN;
    END IF;
    IF v_user.status <> 'active' THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'user_not_active'; RETURN;
    END IF;
    IF NOT COALESCE(v_user.phone_verified, FALSE) THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'user_not_verified'; RETURN;
    END IF;

    SELECT id, user_id, is_available, deleted_at
      INTO v_pandit FROM pandits WHERE id = p_pandit_id;
    IF NOT FOUND OR v_pandit.deleted_at IS NOT NULL THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'pandit_not_found'; RETURN;
    END IF;
    IF v_pandit.user_id = p_user_id THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'self_contact'; RETURN;
    END IF;

    -- One bigint key (both ids hashed together) — matches the
    -- pg_advisory_xact_lock(bigint) overload that actually exists (fixed by
    -- migration 20; see the note above CREATE OR REPLACE).
    PERFORM pg_advisory_xact_lock(
        hashtextextended(p_pandit_id::text || ':' || p_user_id::text, 42)
    );

    SELECT id INTO v_existing
      FROM qualified_leads
     WHERE pandit_id = p_pandit_id
       AND user_id = p_user_id
       AND dedup_window_ends_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1;

    IF FOUND THEN
        UPDATE qualified_leads
           SET interaction_count   = interaction_count + 1,
               last_interaction_at = NOW(),
               last_contact_method = p_method
         WHERE id = v_existing.id;
        RETURN QUERY SELECT v_existing.id, FALSE, 'duplicate_window'; RETURN;
    END IF;

    v_country := country_from_phone(v_user.phone);

    IF v_country IS NOT NULL THEN
        v_market  := CASE WHEN v_country = 'IN' THEN 'INDIA' ELSE 'INTERNATIONAL' END;
        v_msource := 'VERIFIED_PHONE';
    ELSE
        v_market  := 'INDIA';
        v_msource := 'ADMIN_OVERRIDE';
    END IF;

    INSERT INTO qualified_leads (
        pandit_id, user_id, first_contact_method, last_contact_method,
        contact_name_snapshot, contact_phone_snapshot,
        contact_city_snapshot, contact_state_snapshot,
        dedup_window_ends_at, source,
        market, market_source, temple_id, service_id
    ) VALUES (
        p_pandit_id, p_user_id, p_method, p_method,
        v_user.full_name, v_user.phone,
        -- The devotee's own city when they gave one, otherwise the edge's
        -- guess from their last login. Snapshotted here for the same reason
        -- the city was: RLS gives a pandit session no SELECT on an arbitrary
        -- devotee row, so the leads query's live JOIN returns NULL and only
        -- what is captured at this moment ever reaches the pandit.
        COALESCE(v_user.city, v_user.geo_city),
        COALESCE(v_user.state, v_user.geo_region),
        NOW() + (p_dedup_hours || ' hours')::interval, p_source,
        v_market, v_msource, p_temple_id, p_service_id
    ) RETURNING id INTO v_new_id;

    RETURN QUERY SELECT v_new_id, TRUE, 'created';
END;
$function$;

COMMENT ON COLUMN public.qualified_leads.contact_city_snapshot IS
  'City as best known when the lead was created: the devotee''s own users.city if they gave one, otherwise the CloudFront edge guess in users.geo_city. Snapshotted because RLS on users does not grant a pandit session SELECT on an arbitrary devotee row — see migration 27 for why the live JOIN alone silently returns NULL.';

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'record_qualified_lead'
       AND pg_get_functiondef(p.oid) LIKE '%COALESCE(v_user.city, v_user.geo_city)%'
  ) THEN
    RAISE EXCEPTION 'Migration 0010 incomplete — record_qualified_lead does not fall back to geo_city';
  END IF;
  -- The rewrite must not have cost the function its elevated context; without
  -- it the whole lead path stops working, not just the city.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'record_qualified_lead' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'Migration 0010 incomplete — record_qualified_lead is no longer SECURITY DEFINER';
  END IF;
END
$verify$;
