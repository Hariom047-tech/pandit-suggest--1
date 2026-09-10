-- ============================================================================
-- PanditSuggest — production schema baseline
-- ============================================================================
-- GENERATED FILE. Do not hand-edit.
--   Regenerate: backend/src/db/tools/build-baseline.sh <scratch-db>
--   Source:     historical/01-schema.sql (transformed) + historical/03..36
--               + tools/hardening.sql
--   Excluded:   historical/02-seed.sql (demo content — never production)
--
-- This is the ONLY bootstrap mechanism for a new production database. The
-- historical migrations are provenance, not a deployment path.
--
-- Contains schema only: extensions, types, tables, constraints, indexes,
-- functions, triggers, views, RLS, policies and grants. No rows of any kind.
-- Roles are created NOLOGIN and WITHOUT passwords; the cutover runbook grants
-- LOGIN and sets credentials from AWS Secrets Manager.
-- ============================================================================

DO $roles$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['panditsuggest_owner','panditsuggest_migrator',
                           'panditsuggest_app','panditsuggest_readonly'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $roles$;

-- Every object below is owned by panditsuggest_owner, never by the migrator
-- that happens to be applying this and never by the RDS master user. That is
-- what makes FORCE ROW LEVEL SECURITY meaningful: no login role owns these
-- tables, so no login role can bypass their policies.
SET ROLE panditsuggest_owner;


-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
-- Emitted explicitly rather than left to pg_dump: --schema=public omits them
-- entirely, and on RDS these must be created before anything that depends on
-- them (PostGIS for the geo indexes, vector for the AI HNSW index, pgcrypto
-- for gen_random_uuid()). All are on the RDS PostgreSQL 16 supported list;
-- verify the target minor ships vector >= 0.8 before cutover.
CREATE EXTENSION IF NOT EXISTS pgcrypto  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS postgis   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg11+2)
-- Dumped by pg_dump version 16.4 (Debian 16.4-1.pgdg110+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- [build-baseline] CREATE SCHEMA public omitted: it always exists.


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

-- [build-baseline] COMMENT ON SCHEMA public omitted: requires schema ownership.


--
-- Name: account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_status AS ENUM (
    'pending_verification',
    'active',
    'suspended',
    'deactivated',
    'banned'
);


--
-- Name: activity_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_event_type AS ENUM (
    'LOGIN',
    'LOGOUT',
    'SEARCH',
    'TEMPLE_VIEW',
    'SERVICE_VIEW',
    'PANDIT_PROFILE_VIEW',
    'PANDIT_CHAT_CLICK',
    'PANDIT_CALL_CLICK',
    'AI_RECOMMENDATION',
    'INQUIRY_SUBMITTED',
    'QUALIFIED_LEAD_CREATED',
    'BOOKING_CREATED',
    'REVIEW_CREATED'
);


--
-- Name: activity_source_surface; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.activity_source_surface AS ENUM (
    'HOME',
    'PANDIT_DIRECTORY',
    'TEMPLE_DETAIL',
    'SERVICE_DETAIL',
    'SEARCH',
    'PANDIT_PROFILE',
    'AI_GUIDE',
    'OTHER'
);


--
-- Name: contact_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contact_method AS ENUM (
    'whatsapp',
    'phone_call',
    'in_app_message',
    'email'
);


--
-- Name: content_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.content_status AS ENUM (
    'draft',
    'published',
    'archived',
    'flagged',
    'removed'
);


--
-- Name: day_of_week; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.day_of_week AS ENUM (
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
);


--
-- Name: inquiry_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.inquiry_status AS ENUM (
    'new',
    'seen',
    'replied',
    'completed',
    'expired'
);


--
-- Name: lead_market; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_market AS ENUM (
    'INDIA',
    'INTERNATIONAL'
);


--
-- Name: lead_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_status AS ENUM (
    'new',
    'viewed',
    'contacted',
    'completed',
    'not_reachable'
);


--
-- Name: market_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.market_source AS ENUM (
    'VERIFIED_PHONE',
    'VERIFIED_ACCOUNT',
    'USER_SELECTED',
    'IP_GEO',
    'ADMIN_OVERRIDE'
);


--
-- Name: media_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_type AS ENUM (
    'photo',
    'video',
    'video_intro',
    'certificate',
    'virtual_tour_360',
    'thumbnail'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'festival_alert',
    'new_review',
    'inquiry_received',
    'profile_verified',
    'subscription_expiring',
    'subscription_renewed',
    'featured_placement',
    'system_announcement',
    'panchang_alert'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded',
    'cancelled'
);


--
-- Name: reviewable_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.reviewable_type AS ENUM (
    'pandit',
    'temple',
    'platform'
);


--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_tier AS ENUM (
    'free',
    'silver',
    'gold',
    'diamond'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'devotee',
    'pandit',
    'temple_admin',
    'admin',
    'super_admin'
);


--
-- Name: verification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_status AS ENUM (
    'unverified',
    'documents_submitted',
    'under_review',
    'verified',
    'rejected'
);


--
-- Name: activate_pandit_subscription(uuid, public.subscription_tier, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_pandit_subscription(p_pandit_id uuid, p_tier public.subscription_tier, p_expires_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  IF p_pandit_id IS NULL OR p_tier IS NULL OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'activate_pandit_subscription: all arguments are required';
  END IF;

  -- Bound the grant. An expiry in the past is meaningless; one decades out is
  -- either a bug or an attack.
  IF p_expires_at <= NOW() THEN
    RAISE EXCEPTION 'activate_pandit_subscription: expiry % is not in the future', p_expires_at;
  END IF;
  IF p_expires_at > NOW() + INTERVAL '10 years' THEN
    RAISE EXCEPTION 'activate_pandit_subscription: expiry % exceeds the 10 year ceiling', p_expires_at;
  END IF;

  -- The entitlement must already exist as an active subscription row whose
  -- plan tier and expiry match what is being written, AND be backed either by
  -- a captured payment or by an explicitly-recorded manual admin grant.
  SELECT EXISTS (
    SELECT 1
      FROM pandit_subscriptions s
      JOIN subscription_plans   pl ON pl.id = s.plan_id
     WHERE s.pandit_id  = p_pandit_id
       AND s.is_active
       AND pl.tier      = p_tier
       AND s.expires_at = p_expires_at
       AND (
             s.billing_cycle = 'manual'          -- audited admin override
             OR EXISTS (
                  SELECT 1 FROM payment_transactions t
                   WHERE t.id = s.last_payment_id
                     AND t.status = 'completed'
                )
           )
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION
      'activate_pandit_subscription: refusing to grant tier % to pandit % — no active subscription backed by a completed payment or a manual admin grant',
      p_tier, p_pandit_id;
  END IF;

  -- Seat-cap override is retained deliberately: capacity is enforced at
  -- purchase time (subscribe()/seat_usage()), and migration 19's trigger
  -- would otherwise block a legitimately-paid renewal into a full tier.
  PERFORM set_config('app.allow_seat_overflow', 'on', true);

  UPDATE pandits
     SET current_tier            = p_tier,
         subscription_expires_at = p_expires_at,
         is_paused               = FALSE,
         paused_reason           = NULL,
         paused_at               = NULL
   WHERE id = p_pandit_id;

  UPDATE pandits SET rank_score = calculate_pandit_rank(id) WHERE id = p_pandit_id;
END;
$$;


--
-- Name: admin_find_challenge_with_user(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_find_challenge_with_user(p_token_hash text) RETURNS TABLE(challenge_id uuid, user_id uuid, pending_totp_secret_encrypted text, email character varying, full_name character varying, role public.user_role, status public.account_status, totp_secret_encrypted text, totp_enabled boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    SELECT c.id, u.id, c.pending_totp_secret_encrypted,
           u.email, u.full_name, u.role, u.status, u.totp_secret_encrypted, u.totp_enabled
    FROM admin_mfa_challenges c JOIN users u ON u.id = c.user_id
    WHERE c.challenge_token_hash = p_token_hash AND c.consumed_at IS NULL AND c.expires_at > NOW();
$$;


--
-- Name: ai_propagate_doc_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_propagate_doc_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.language IS DISTINCT FROM OLD.language
     OR NEW.document_type IS DISTINCT FROM OLD.document_type THEN
    UPDATE ai_knowledge_chunks
       SET is_retrievable = (NEW.status = 'published' AND NEW.verified),
           language       = NEW.language,
           document_type  = NEW.document_type
     WHERE document_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;


--
-- Name: ai_sync_chunk_denorm(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_sync_chunk_denorm() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  SELECT d.language, d.document_type, (d.status = 'published' AND d.verified)
    INTO NEW.language, NEW.document_type, NEW.is_retrievable
    FROM ai_knowledge_documents d WHERE d.id = NEW.document_id;
  RETURN NEW;
END
$$;


--
-- Name: auth_consume_reset_challenge(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_consume_reset_challenge(p_token_hash text, p_new_password_hash text) RETURNS TABLE(ok boolean, user_id uuid, reason text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_challenge RECORD;
BEGIN
    UPDATE password_reset_challenges
       SET consumed_at = NOW()
     WHERE token_hash = p_token_hash
       AND consumed_at IS NULL
       AND invalidated_at IS NULL
       AND expires_at > NOW()
       AND attempts < max_attempts
    RETURNING id, password_reset_challenges.user_id INTO v_challenge;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 'invalid_or_expired'; RETURN;
    END IF;

    UPDATE users SET password_hash = p_new_password_hash WHERE id = v_challenge.user_id;
    UPDATE user_sessions SET revoked_at = NOW()
     WHERE user_sessions.user_id = v_challenge.user_id AND revoked_at IS NULL;

    RETURN QUERY SELECT TRUE, v_challenge.user_id, 'reset';
END;
$$;


--
-- Name: auth_create_reset_challenge(uuid, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_create_reset_challenge(p_user_id uuid, p_token_hash text, p_ttl_minutes integer, p_ip text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_id UUID;
BEGIN
    -- Only one live challenge per account: requesting a new one voids the old.
    UPDATE password_reset_challenges
       SET invalidated_at = NOW()
     WHERE user_id = p_user_id AND consumed_at IS NULL AND invalidated_at IS NULL;

    INSERT INTO password_reset_challenges (user_id, token_hash, expires_at, request_ip)
    VALUES (p_user_id, p_token_hash,
            NOW() + (p_ttl_minutes || ' minutes')::interval,
            NULLIF(p_ip, '')::inet)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


--
-- Name: auth_find_pandit_for_reset(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_find_pandit_for_reset(p_email text, p_dob date) RETURNS TABLE(user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    SELECT u.id
      FROM users u
      JOIN pandits p ON p.user_id = u.id AND p.deleted_at IS NULL
     WHERE lower(u.email) = lower(p_email)
       AND u.date_of_birth IS NOT NULL
       AND u.date_of_birth = p_dob
       AND u.role = 'pandit'
       AND u.status IN ('active', 'pending_verification')
       AND u.deleted_at IS NULL
     LIMIT 1;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255),
    phone character varying(15),
    password_hash character varying(255),
    full_name character varying(150) NOT NULL,
    display_name character varying(100),
    avatar_url text,
    role public.user_role DEFAULT 'devotee'::public.user_role NOT NULL,
    status public.account_status DEFAULT 'pending_verification'::public.account_status NOT NULL,
    city character varying(100),
    state character varying(100),
    pincode character varying(10),
    latitude numeric(10,8),
    longitude numeric(11,8),
    preferred_language character varying(20) DEFAULT 'hi'::character varying,
    theme_preference character varying(20) DEFAULT 'light'::character varying,
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    last_login_at timestamp with time zone,
    login_count integer DEFAULT 0,
    google_id character varying(255),
    facebook_id character varying(255),
    totp_secret_encrypted text,
    totp_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    date_of_birth date,
    country character varying(2)
);


--
-- Name: COLUMN users.date_of_birth; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.date_of_birth IS 'Set by an admin when provisioning a pandit account. Used ONLY as the second factor in the email+DOB password-reset challenge. Never returned by any API.';


--
-- Name: COLUMN users.country; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.country IS 'ISO-3166-1 alpha-2, resolved opportunistically from verified phone or trusted CDN geo header — see market.js. NULL is a real "unknown", never guessed.';


--
-- Name: auth_find_user_by_email(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_find_user_by_email(p_email text) RETURNS SETOF public.users
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    SELECT * FROM users WHERE lower(email) = lower(p_email) AND deleted_at IS NULL LIMIT 1;
$$;


--
-- Name: auth_find_user_by_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auth_find_user_by_phone(p_phone text) RETURNS SETOF public.users
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    SELECT * FROM users WHERE phone = p_phone AND deleted_at IS NULL LIMIT 1;
$$;


--
-- Name: calculate_pandit_rank(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_pandit_rank(p_id uuid) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    rank DECIMAL(10, 4);
    p RECORD;
BEGIN
    SELECT * INTO p FROM pandits WHERE id = p_id;
    IF NOT FOUND THEN RETURN 0; END IF;

    rank := 0;
    rank := rank + (COALESCE(p.avg_rating, 0) * 8);                    -- rating, max 40
    rank := rank + LEAST(COALESCE(p.review_count, 0) * 0.5, 20);       -- review volume, max 20
    IF p.verification_status = 'verified' THEN rank := rank + 15; END IF;

    CASE p.current_tier
        WHEN 'diamond' THEN rank := rank + 15;
        WHEN 'gold' THEN rank := rank + 10;
        WHEN 'silver' THEN rank := rank + 5;
        ELSE rank := rank + 0;
    END CASE;

    IF p.video_intro_url IS NOT NULL THEN rank := rank + 3; END IF;
    IF p.bio IS NOT NULL AND LENGTH(p.bio) > 100 THEN rank := rank + 3; END IF;
    IF p.profile_photo_url IS NOT NULL THEN rank := rank + 2; END IF;
    IF p.whatsapp_number IS NOT NULL THEN rank := rank + 2; END IF;

    RETURN rank;
END;
$$;


--
-- Name: country_from_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.country_from_phone(p_phone text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    digits TEXT;
BEGIN
    IF p_phone IS NULL THEN RETURN NULL; END IF;

    digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
    IF digits = '' THEN RETURN NULL; END IF;

    -- Bare national-format Indian mobile: 10 digits starting 6-9. This is the
    -- format most of the existing user base is stored in, and on an India-first
    -- platform it is genuine evidence, not a guess.
    IF length(digits) = 10 AND substring(digits, 1, 1) ~ '[6-9]' THEN
        RETURN 'IN';
    END IF;

    -- Strip a leading 00 international prefix.
    IF left(digits, 2) = '00' THEN digits := substring(digits, 3); END IF;

    -- Longest codes first.
    IF left(digits, 3) = '971' THEN RETURN 'AE'; END IF;
    IF left(digits, 3) = '977' THEN RETURN 'NP'; END IF;
    IF left(digits, 3) = '880' THEN RETURN 'BD'; END IF;
    IF left(digits, 2) = '91'  THEN RETURN 'IN'; END IF;
    IF left(digits, 2) = '94'  THEN RETURN 'LK'; END IF;
    IF left(digits, 2) = '44'  THEN RETURN 'GB'; END IF;
    IF left(digits, 2) = '61'  THEN RETURN 'AU'; END IF;
    IF left(digits, 2) = '65'  THEN RETURN 'SG'; END IF;
    IF left(digits, 2) = '60'  THEN RETURN 'MY'; END IF;
    IF left(digits, 2) = '64'  THEN RETURN 'NZ'; END IF;
    IF left(digits, 2) = '27'  THEN RETURN 'ZA'; END IF;
    -- +1 is North America. Tested last because it is a single digit and would
    -- otherwise swallow nothing else here, but the ordering is load-bearing if
    -- codes are added later.
    IF left(digits, 1) = '1' AND length(digits) = 11 THEN RETURN 'US'; END IF;

    RETURN NULL;
END;
$$;


--
-- Name: FUNCTION country_from_phone(p_phone text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.country_from_phone(p_phone text) IS 'ISO country from a phone number. Used for lead market attribution — must stay in sync with countryFromPhone() in services/distribution/market.js.';


--
-- Name: current_app_session_key(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_app_session_key() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.current_session_key', true), '');
$$;


--
-- Name: current_app_user_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_app_user_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;


--
-- Name: current_app_user_is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_app_user_is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM users
        WHERE id = current_app_user_id() AND role IN ('admin', 'super_admin') AND deleted_at IS NULL
    );
$$;


--
-- Name: enforce_seat_cap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_seat_cap() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v RECORD;
BEGIN
    -- Not a tier arrival: nothing to check.
    IF TG_OP = 'UPDATE' AND NEW.current_tier IS NOT DISTINCT FROM OLD.current_tier THEN
        RETURN NEW;
    END IF;

    -- 'free' is not a sold plan and is never capped.
    IF NEW.current_tier IS NULL OR NEW.current_tier = 'free' THEN
        RETURN NEW;
    END IF;

    /*
     * Explicit override.
     *
     * An admin may have a genuine reason to oversell — a promised seat, a
     * migration, a bulk import. Blocking that outright would mean the only way
     * forward is to disable the cap entirely, which is how safety rails get
     * removed permanently. So the escape hatch is per-transaction, deliberate,
     * and has to be set by the caller.
     */
    IF COALESCE(current_setting('app.allow_seat_overflow', true), '') = 'on' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v FROM seat_usage(NEW.current_tier);

    IF v.seat_cap IS NULL THEN
        RETURN NEW;                       -- uncapped tier
    END IF;

    IF v.held >= v.seat_cap THEN
        RAISE EXCEPTION 'seat_cap_reached'
          USING DETAIL = format('%s is full: %s of %s seats held.', NEW.current_tier, v.held, v.seat_cap),
                HINT = 'Raise the seat cap in Distribution Controls, or set app.allow_seat_overflow to deliberately oversell.',
                ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: get_pandit_lead_counts(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pandit_lead_counts(p_since timestamp with time zone, p_today_start timestamp with time zone) RETURNS TABLE(pandit_id uuid, window_leads bigint, today_leads bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
    SELECT ql.pandit_id,
           COUNT(*)::BIGINT AS window_leads,
           COUNT(*) FILTER (WHERE ql.created_at >= p_today_start)::BIGINT AS today_leads
      FROM qualified_leads ql
     WHERE ql.created_at >= p_since
     GROUP BY ql.pandit_id;
$$;


--
-- Name: increment_pandit_stats(uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_pandit_stats(p_id uuid, p_type character varying, p_method character varying DEFAULT NULL::character varying) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF p_type = 'view' THEN
        UPDATE pandits SET total_profile_views = total_profile_views + 1 WHERE id = p_id;
    ELSIF p_type = 'click' THEN
        UPDATE pandits SET total_contact_clicks = total_contact_clicks + 1 WHERE id = p_id;
        IF p_method = 'whatsapp' THEN
            UPDATE pandits SET total_whatsapp_clicks = total_whatsapp_clicks + 1 WHERE id = p_id;
        ELSIF p_method = 'phone_call' THEN
            UPDATE pandits SET total_call_clicks = total_call_clicks + 1 WHERE id = p_id;
        END IF;
    END IF;
END;
$$;


--
-- Name: record_qualified_lead(uuid, uuid, public.contact_method, integer, character varying, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_qualified_lead(p_pandit_id uuid, p_user_id uuid, p_method public.contact_method, p_dedup_hours integer, p_source character varying DEFAULT NULL::character varying, p_temple_id uuid DEFAULT NULL::uuid, p_service_id uuid DEFAULT NULL::uuid) RETURNS TABLE(lead_id uuid, was_created boolean, reason text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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

    SELECT id, full_name, phone, status, phone_verified, deleted_at, city, state
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
        v_user.city, v_user.state,
        NOW() + (p_dedup_hours || ' hours')::interval, p_source,
        v_market, v_msource, p_temple_id, p_service_id
    ) RETURNING id INTO v_new_id;

    RETURN QUERY SELECT v_new_id, TRUE, 'created';
END;
$$;


--
-- Name: revert_expired_pandit_tiers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revert_expired_pandit_tiers() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_ids UUID[];
    v_id  UUID;
BEGIN
    WITH reverted AS (
        UPDATE pandits
           SET current_tier = 'free',
               subscription_expires_at = NULL,
               is_paused = TRUE,
               paused_reason = 'subscription_expired',
               paused_at = NOW()
         WHERE current_tier <> 'free'
           AND subscription_expires_at IS NOT NULL
           AND subscription_expires_at <= NOW()
           AND NOT EXISTS (
             SELECT 1 FROM pandit_subscriptions ps
              WHERE ps.pandit_id = pandits.id AND ps.is_active = TRUE AND ps.expires_at > NOW()
           )
        RETURNING id
    )
    SELECT array_agg(id) INTO v_ids FROM reverted;

    IF v_ids IS NOT NULL THEN
        FOREACH v_id IN ARRAY v_ids LOOP
            UPDATE pandits SET rank_score = calculate_pandit_rank(id) WHERE id = v_id;
        END LOOP;
    END IF;

    RETURN COALESCE(array_length(v_ids, 1), 0);
END;
$$;


--
-- Name: seat_usage(public.subscription_tier); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seat_usage(p_tier public.subscription_tier) RETURNS TABLE(tier text, seat_cap integer, held integer, available integer)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_cap  INTEGER;
    v_held INTEGER;
BEGIN
    -- One cap per tier. A tier entitled to two markets has the same seat count
    -- in both — you sell a plan, not a plan-per-market — so MIN() collapses
    -- the rows rather than double-counting.
    SELECT MIN(e.seat_cap) INTO v_cap
      FROM plan_market_entitlements e
     WHERE e.tier = p_tier AND e.is_active;

    SELECT COUNT(*)::int INTO v_held
      FROM pandits p
      JOIN users u ON u.id = p.user_id
     WHERE p.current_tier = p_tier
       AND p.deleted_at IS NULL
       AND u.deleted_at IS NULL
       AND u.status = 'active'
       AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > NOW());

    RETURN QUERY SELECT p_tier::text, v_cap, v_held,
        CASE WHEN v_cap IS NULL THEN NULL ELSE GREATEST(0, v_cap - v_held) END;
END;
$$;


--
-- Name: FUNCTION seat_usage(p_tier public.subscription_tier); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.seat_usage(p_tier public.subscription_tier) IS 'Live seats held vs the sales cap. available IS NULL means the tier is uncapped.';


--
-- Name: set_distribution_config(character varying, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_distribution_config(p_key character varying, p_value numeric, p_admin_id uuid) RETURNS TABLE(key character varying, value numeric, changed boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_row RECORD;
BEGIN
    SELECT dc.key, dc.value, dc.min_value, dc.max_value INTO v_row
      FROM distribution_config dc WHERE dc.key = p_key;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown distribution config key: %', p_key
          USING HINT = 'Keys are fixed by migration. The panel cannot invent new ones.';
    END IF;

    -- Bounds are enforced HERE, not only in the UI. A value outside them does
    -- not error the engine — it silently changes how ranking behaves, which is
    -- far worse than a rejected save.
    IF v_row.min_value IS NOT NULL AND p_value < v_row.min_value THEN
        RAISE EXCEPTION '% must be at least % (got %)', p_key, v_row.min_value, p_value;
    END IF;
    IF v_row.max_value IS NOT NULL AND p_value > v_row.max_value THEN
        RAISE EXCEPTION '% must be at most % (got %)', p_key, v_row.max_value, p_value;
    END IF;

    IF v_row.value = p_value THEN
        RETURN QUERY SELECT p_key, p_value, FALSE; RETURN;
    END IF;

    INSERT INTO distribution_config_audit (scope, target, old_value, new_value, changed_by)
    VALUES ('config', p_key, v_row.value::text, p_value::text, p_admin_id);

    UPDATE distribution_config dc
       SET value = p_value, updated_by = p_admin_id, updated_at = NOW()
     WHERE dc.key = p_key;

    RETURN QUERY SELECT p_key, p_value, TRUE;
END;
$$;


--
-- Name: set_plan_entitlement(public.subscription_tier, public.lead_market, numeric, integer, integer, integer, integer, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_plan_entitlement(p_tier public.subscription_tier, p_market public.lead_market, p_weight numeric, p_daily_cap integer, p_priority integer, p_seat_cap integer, p_price integer, p_active boolean, p_admin_id uuid) RETURNS TABLE(tier text, market text, changed boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_old RECORD;
BEGIN
    IF p_weight < 0 OR p_weight > 1 THEN
        RAISE EXCEPTION 'allocation_weight must be between 0 and 1 (got %)', p_weight;
    END IF;
    IF p_daily_cap < 0 THEN
        RAISE EXCEPTION 'daily_lead_cap cannot be negative';
    END IF;
    IF p_seat_cap IS NOT NULL AND p_seat_cap < 0 THEN
        RAISE EXCEPTION 'seat_cap cannot be negative';
    END IF;

    SELECT * INTO v_old FROM plan_market_entitlements e
     WHERE e.tier = p_tier AND e.market = p_market;

    IF NOT FOUND THEN
        -- Creating a (tier, market) pair is a real product decision — it grants
        -- a plan access to a market it could not reach before. Allowed, but
        -- audited like everything else.
        INSERT INTO plan_market_entitlements
            (tier, market, allocation_weight, daily_lead_cap, priority_order, seat_cap, plan_price_inr, is_active)
        VALUES (p_tier, p_market, p_weight, p_daily_cap, p_priority, p_seat_cap, p_price, p_active);

        INSERT INTO distribution_config_audit (scope, target, old_value, new_value, changed_by)
        VALUES ('entitlement', p_tier || '/' || p_market, NULL,
                format('weight=%s cap=%s priority=%s seats=%s price=%s active=%s',
                       p_weight, p_daily_cap, p_priority, p_seat_cap, p_price, p_active),
                p_admin_id);

        RETURN QUERY SELECT p_tier::text, p_market::text, TRUE; RETURN;
    END IF;

    INSERT INTO distribution_config_audit (scope, target, old_value, new_value, changed_by)
    VALUES ('entitlement', p_tier || '/' || p_market,
            format('weight=%s cap=%s priority=%s seats=%s price=%s active=%s',
                   v_old.allocation_weight, v_old.daily_lead_cap, v_old.priority_order,
                   v_old.seat_cap, v_old.plan_price_inr, v_old.is_active),
            format('weight=%s cap=%s priority=%s seats=%s price=%s active=%s',
                   p_weight, p_daily_cap, p_priority, p_seat_cap, p_price, p_active),
            p_admin_id);

    UPDATE plan_market_entitlements e
       SET allocation_weight = p_weight,
           daily_lead_cap    = p_daily_cap,
           priority_order    = p_priority,
           seat_cap          = p_seat_cap,
           plan_price_inr    = p_price,
           is_active         = p_active,
           updated_at        = NOW()
     WHERE e.tier = p_tier AND e.market = p_market;

    RETURN QUERY SELECT p_tier::text, p_market::text, TRUE;
END;
$$;


--
-- Name: update_pandit_review_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pandit_review_stats() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_type reviewable_type := COALESCE(NEW.reviewable_type, OLD.reviewable_type);
    v_id   UUID := COALESCE(NEW.reviewable_id, OLD.reviewable_id);
BEGIN
    IF v_type = 'pandit' THEN
        UPDATE pandits SET
            review_count = (
                SELECT COUNT(*) FROM reviews
                WHERE reviewable_type = 'pandit' AND reviewable_id = v_id
                  AND is_approved = TRUE AND deleted_at IS NULL
            ),
            avg_rating = (
                SELECT COALESCE(AVG(rating), 0) FROM reviews
                WHERE reviewable_type = 'pandit' AND reviewable_id = v_id
                  AND is_approved = TRUE AND deleted_at IS NULL
            )
        WHERE id = v_id;
        UPDATE pandits SET rank_score = calculate_pandit_rank(v_id) WHERE id = v_id;
    END IF;

    IF v_type = 'temple' THEN
        UPDATE temples SET
            review_count = (
                SELECT COUNT(*) FROM reviews
                WHERE reviewable_type = 'temple' AND reviewable_id = v_id
                  AND is_approved = TRUE AND deleted_at IS NULL
            ),
            avg_rating = (
                SELECT COALESCE(AVG(rating), 0) FROM reviews
                WHERE reviewable_type = 'temple' AND reviewable_id = v_id
                  AND is_approved = TRUE AND deleted_at IS NULL
            )
        WHERE id = v_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_temple_pandit_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_temple_pandit_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE temples SET pandit_count = (
        SELECT COUNT(*) FROM pandit_temples
        WHERE temple_id = COALESCE(NEW.temple_id, OLD.temple_id) AND is_active = TRUE
    )
    WHERE id = COALESCE(NEW.temple_id, OLD.temple_id);
    RETURN COALESCE(NEW, OLD);
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: admin_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_activity_log (
    id bigint NOT NULL,
    admin_user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_id uuid,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_activity_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_activity_log_id_seq OWNED BY public.admin_activity_log.id;


--
-- Name: admin_mfa_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_mfa_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    challenge_token_hash character varying(255) NOT NULL,
    pending_totp_secret_encrypted text,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    ip_address inet,
    user_agent text,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_key character varying(64),
    title character varying(200),
    language character varying(10),
    memory jsonb DEFAULT '{}'::jsonb NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_conv_memory_is_object CHECK ((jsonb_typeof(memory) = 'object'::text)),
    CONSTRAINT ai_conv_owner_present CHECK (((user_id IS NOT NULL) OR (session_key IS NOT NULL)))
);


--
-- Name: ai_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid,
    session_key character varying(64),
    helpful boolean NOT NULL,
    reason character varying(40),
    note character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_knowledge_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    heading character varying(300),
    token_count integer,
    embedding public.vector(1536),
    language character varying(10),
    document_type character varying(40),
    is_retrievable boolean DEFAULT false NOT NULL,
    content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, (((COALESCE(heading, ''::character varying))::text || ' '::text) || content))) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_knowledge_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(300) NOT NULL,
    body text NOT NULL,
    document_type character varying(40) NOT NULL,
    language character varying(10) DEFAULT 'hinglish'::character varying NOT NULL,
    service_id uuid,
    temple_id uuid,
    deity character varying(120),
    intent_tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    problem_categories jsonb DEFAULT '[]'::jsonb NOT NULL,
    city character varying(120),
    state character varying(120),
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    source character varying(200) DEFAULT 'admin'::character varying NOT NULL,
    source_ref character varying(200),
    version integer DEFAULT 1 NOT NULL,
    indexed_at timestamp with time zone,
    index_error text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_doc_language_valid CHECK (((language)::text = ANY ((ARRAY['hi'::character varying, 'en'::character varying, 'hinglish'::character varying])::text[]))),
    CONSTRAINT ai_doc_status_valid CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[]))),
    CONSTRAINT ai_doc_tags_are_arrays CHECK (((jsonb_typeof(intent_tags) = 'array'::text) AND (jsonb_typeof(problem_categories) = 'array'::text)))
);


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    intent jsonb,
    retrieval jsonb,
    recommendations jsonb,
    confidence numeric(4,3),
    model character varying(80),
    input_tokens integer,
    output_tokens integer,
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_msg_role_valid CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying])::text[])))
);


--
-- Name: ai_problem_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_problem_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(80) NOT NULL,
    name_en character varying(120) NOT NULL,
    name_hi character varying(120),
    parent_id uuid,
    description text,
    example_phrases jsonb DEFAULT '[]'::jsonb NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_problem_service_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_problem_service_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    problem_category_id uuid NOT NULL,
    service_id uuid NOT NULL,
    relevance_score numeric(3,2) DEFAULT 0.80 NOT NULL,
    reason text,
    temple_id uuid,
    deity character varying(120),
    status character varying(20) DEFAULT 'published'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_mapping_score_range CHECK (((relevance_score >= (0)::numeric) AND (relevance_score <= (1)::numeric))),
    CONSTRAINT ai_mapping_status_valid CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: ai_query_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_query_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    query_text text NOT NULL,
    language character varying(10),
    detected_intent character varying(80),
    problem_category character varying(80),
    requested_service character varying(200),
    requested_city character varying(120),
    requested_state character varying(120),
    requested_temple character varying(200),
    retrieval_top_score numeric(5,4),
    chunks_retrieved integer,
    services_found integer DEFAULT 0 NOT NULL,
    pandits_found integer DEFAULT 0 NOT NULL,
    gap_type character varying(30),
    fallback_used character varying(40),
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_gap_type_valid CHECK (((gap_type IS NULL) OR ((gap_type)::text = ANY ((ARRAY['no_knowledge'::character varying, 'no_service'::character varying, 'no_pandit'::character varying, 'low_confidence'::character varying])::text[]))))
);


--
-- Name: ai_ranking_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_ranking_config (
    key character varying(60) NOT NULL,
    value numeric(6,3) NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_recommendation_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_recommendation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid,
    message_id uuid,
    event_type character varying(40) NOT NULL,
    pandit_id uuid,
    service_id uuid,
    temple_id uuid,
    "position" integer,
    score numeric(5,4),
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_event_type_valid CHECK (((event_type)::text = ANY ((ARRAY['ai_response_shown'::character varying, 'service_recommended'::character varying, 'temple_recommended'::character varying, 'pandit_recommended'::character varying, 'pandit_card_clicked'::character varying, 'pandit_profile_opened'::character varying, 'call_clicked'::character varying, 'whatsapp_clicked'::character varying, 'booking_started'::character varying, 'booking_completed'::character varying])::text[])))
);


--
-- Name: ai_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    user_query text NOT NULL,
    user_situation text,
    recommended_services uuid[],
    recommendation_text text,
    confidence_score numeric(5,4),
    model_version character varying(50),
    response_time_ms integer,
    was_helpful boolean,
    user_feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: banned_ips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banned_ips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_address inet NOT NULL,
    reason character varying(500),
    banned_by uuid,
    banned_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    unbanned_at timestamp with time zone,
    unbanned_by uuid
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    title character varying(300) NOT NULL,
    slug character varying(350) NOT NULL,
    excerpt character varying(500),
    body text NOT NULL,
    cover_image_url text,
    category character varying(100),
    tags text[],
    meta_title character varying(200),
    meta_description character varying(500),
    view_count bigint DEFAULT 0,
    like_count integer DEFAULT 0,
    status public.content_status DEFAULT 'draft'::public.content_status,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: community_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    body text NOT NULL,
    like_count integer DEFAULT 0,
    status public.content_status DEFAULT 'published'::public.content_status,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: community_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.community_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(300) NOT NULL,
    body text NOT NULL,
    category character varying(100),
    view_count bigint DEFAULT 0,
    like_count integer DEFAULT 0,
    comment_count integer DEFAULT 0,
    is_pinned boolean DEFAULT false,
    status public.content_status DEFAULT 'published'::public.content_status,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    user_id uuid,
    contact_method public.contact_method NOT NULL,
    source_page character varying(100),
    temple_id uuid,
    service_id uuid,
    ip_address inet,
    user_agent text,
    device_type character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    qualified_lead_id uuid,
    created_qualified_lead boolean DEFAULT false NOT NULL
);


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(15),
    subject character varying(200),
    message text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: deployment_environment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deployment_environment (
    id boolean DEFAULT true NOT NULL,
    environment text NOT NULL,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    CONSTRAINT deployment_environment_environment_check CHECK ((environment = ANY (ARRAY['production'::text, 'staging'::text, 'development'::text, 'test'::text, 'scratch'::text]))),
    CONSTRAINT deployment_environment_singleton CHECK (id)
);


--
-- Name: TABLE deployment_environment; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.deployment_environment IS 'Single-row environment marker. Set to production on the RDS instance at cutover; the test-suite guard aborts if it finds environment=production. See backend/src/config/testDbGuard.js.';


--
-- Name: distribution_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distribution_config (
    key character varying(60) NOT NULL,
    value numeric(12,3) NOT NULL,
    description text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    min_value numeric(12,3),
    max_value numeric(12,3),
    label text,
    step numeric(12,3) DEFAULT 0.01
);


--
-- Name: distribution_config_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.distribution_config_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope character varying(40) NOT NULL,
    target character varying(80) NOT NULL,
    old_value text,
    new_value text,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: home_hero_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_hero_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    image_url text NOT NULL,
    alt_text character varying(200),
    caption character varying(200),
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    mime_type character varying(50),
    file_size_bytes bigint,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_key text
);


--
-- Name: COLUMN home_hero_images.image_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.home_hero_images.image_key IS 'Raw S3 object key, NULL for pre-migration/local-disk rows. image_url remains authoritative for display.';


--
-- Name: honeypot_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.honeypot_logs (
    id bigint NOT NULL,
    ip_address inet NOT NULL,
    attempted_path character varying(500) NOT NULL,
    method character varying(10),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: honeypot_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.honeypot_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: honeypot_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.honeypot_logs_id_seq OWNED BY public.honeypot_logs.id;


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    pandit_id uuid NOT NULL,
    temple_id uuid,
    service_id uuid,
    full_name character varying(150) NOT NULL,
    phone character varying(15) NOT NULL,
    email character varying(255),
    message text,
    preferred_date date,
    preferred_time time without time zone,
    status public.inquiry_status DEFAULT 'new'::public.inquiry_status,
    contact_method public.contact_method,
    contacted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: newsletter_subscribers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.newsletter_subscribers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.notification_type NOT NULL,
    title character varying(300) NOT NULL,
    body text,
    action_url character varying(500),
    action_data jsonb,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    sent_via_push boolean DEFAULT false,
    sent_via_email boolean DEFAULT false,
    sent_via_sms boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    target character varying(255) NOT NULL,
    target_type character varying(10) NOT NULL,
    otp_hash character varying(255) NOT NULL,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 5,
    verified boolean DEFAULT false,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pandit_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    date date NOT NULL,
    profile_views integer DEFAULT 0,
    search_appearances integer DEFAULT 0,
    whatsapp_clicks integer DEFAULT 0,
    call_clicks integer DEFAULT 0,
    message_clicks integer DEFAULT 0,
    inquiry_count integer DEFAULT 0,
    review_count integer DEFAULT 0,
    views_from_search integer DEFAULT 0,
    views_from_temple integer DEFAULT 0,
    views_from_direct integer DEFAULT 0,
    views_from_featured integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pandit_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    day public.day_of_week NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_available boolean DEFAULT true,
    note character varying(300),
    CONSTRAINT pandit_availability_check CHECK ((end_time > start_time))
);


--
-- Name: pandit_blocked_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_blocked_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    blocked_date date NOT NULL,
    reason character varying(300)
);


--
-- Name: pandit_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    certificate_name character varying(300) NOT NULL,
    institution character varying(300),
    year_obtained integer,
    document_url text,
    is_verified boolean DEFAULT false,
    verified_at timestamp with time zone,
    verified_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pandit_exposure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_exposure (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    temple_id uuid,
    service_id uuid,
    market public.lead_market NOT NULL,
    "position" integer NOT NULL,
    position_weight numeric(4,3) NOT NULL,
    session_key character varying(64),
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exposure_position_positive CHECK (("position" >= 1))
);


--
-- Name: pandit_languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_languages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    language character varying(50) NOT NULL,
    proficiency character varying(30) DEFAULT 'fluent'::character varying
);


--
-- Name: pandit_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    media_url text NOT NULL,
    media_type public.media_type NOT NULL,
    title character varying(200),
    caption character varying(500),
    display_order integer DEFAULT 0,
    file_size_bytes bigint,
    mime_type character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    media_key text
);


--
-- Name: COLUMN pandit_media.media_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pandit_media.media_key IS 'Raw S3 object key (e.g. pandits/<hex>.webp), NULL for pre-migration/local-disk rows. media_url remains authoritative for display.';


--
-- Name: pandit_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    service_id uuid NOT NULL,
    price_range_min numeric(10,2),
    price_range_max numeric(10,2),
    price_note character varying(300),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    offers_online boolean DEFAULT false NOT NULL
);


--
-- Name: COLUMN pandit_services.offers_online; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pandit_services.offers_online IS 'This pandit performs this specific service online.';


--
-- Name: pandit_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    billing_cycle character varying(20) NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    auto_renew boolean DEFAULT true,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    last_payment_id uuid,
    next_billing_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pandit_temples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandit_temples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    temple_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    association_type character varying(50) DEFAULT 'visiting'::character varying,
    since_year integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pandits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pandits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(50) DEFAULT 'Pandit'::character varying,
    bio text,
    short_bio character varying(300),
    experience_years integer DEFAULT 0,
    primary_specialization character varying(200),
    specializations text[],
    traditions text[],
    vedic_knowledge text[],
    public_phone character varying(15),
    whatsapp_number character varying(15),
    public_email character varying(255),
    profile_photo_url text,
    video_intro_url text,
    video_intro_thumbnail text,
    qr_code_url text,
    verification_status public.verification_status DEFAULT 'unverified'::public.verification_status,
    verified_at timestamp with time zone,
    verified_by uuid,
    id_proof_type character varying(50),
    id_proof_number_hash character varying(255),
    video_kyc_completed boolean DEFAULT false,
    review_count integer DEFAULT 0,
    avg_rating numeric(3,2) DEFAULT 0.00,
    total_profile_views bigint DEFAULT 0,
    total_contact_clicks bigint DEFAULT 0,
    total_whatsapp_clicks bigint DEFAULT 0,
    total_call_clicks bigint DEFAULT 0,
    completed_ceremonies integer DEFAULT 0,
    current_tier public.subscription_tier DEFAULT 'free'::public.subscription_tier,
    subscription_expires_at timestamp with time zone,
    is_featured boolean DEFAULT false,
    featured_until timestamp with time zone,
    rank_score numeric(10,4) DEFAULT 0.0,
    is_available boolean DEFAULT true,
    accepts_online boolean DEFAULT false,
    travel_radius_km integer DEFAULT 50,
    min_advance_booking_hrs integer DEFAULT 24,
    slug character varying(200) NOT NULL,
    meta_title character varying(200),
    meta_description character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    vedic_education character varying(300),
    gotra character varying(150),
    tradition character varying(150),
    responds_within character varying(60),
    is_paused boolean DEFAULT false NOT NULL,
    paused_reason text,
    paused_at timestamp with time zone
);


--
-- Name: COLUMN pandits.vedic_education; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pandits.vedic_education IS 'e.g. "Acharya, Sanskrit & Jyotish — Ujjain".';


--
-- Name: COLUMN pandits.gotra; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pandits.gotra IS 'Gotra, shown in the credentials block.';


--
-- Name: COLUMN pandits.tradition; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pandits.tradition IS 'Sampradaya / parampara.';


--
-- Name: COLUMN pandits.responds_within; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pandits.responds_within IS 'Honest, admin-set expectation such as "Usually replies within 2 hours". Deliberately free text and admin-owned rather than computed — a derived response time would be guesswork until there is real messaging data.';


--
-- Name: password_reset_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    method character varying(30) DEFAULT 'email_dob'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    invalidated_at timestamp with time zone,
    request_ip inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    subscription_id uuid,
    plan_id uuid,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'INR'::character varying,
    status public.payment_status DEFAULT 'pending'::public.payment_status,
    gateway character varying(50) NOT NULL,
    gateway_order_id character varying(255),
    gateway_payment_id character varying(255),
    gateway_signature character varying(500),
    gateway_response jsonb,
    invoice_number character varying(50),
    invoice_url text,
    gst_amount numeric(10,2),
    description character varying(500),
    paid_at timestamp with time zone,
    refunded_at timestamp with time zone,
    refund_amount numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    failure_code character varying(100),
    failure_description text,
    plan_name_snapshot character varying(100),
    gateway_refund_id character varying(255),
    CONSTRAINT payment_completed_has_paid_at CHECK (((status <> 'completed'::public.payment_status) OR (paid_at IS NOT NULL))),
    CONSTRAINT payment_refund_within_amount CHECK (((refund_amount IS NULL) OR (refund_amount <= amount)))
);


--
-- Name: COLUMN payment_transactions.failure_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.failure_code IS 'Razorpay error code from a payment.failed webhook event. NULL for anything that never failed.';


--
-- Name: COLUMN payment_transactions.plan_name_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.plan_name_snapshot IS 'subscription_plans.name at the moment this purchase was created — an invoice reads this, never a live join, so a later admin rename does not rewrite history.';


--
-- Name: COLUMN payment_transactions.gateway_refund_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.payment_transactions.gateway_refund_id IS 'Razorpay refund id from a real POST /v1/payments/:id/refund call. NULL means either never refunded, or refunded before a Razorpay account existed to call (a DB-only status flip — see admin/subscriptions.controller.js refund()).';


--
-- Name: plan_market_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_market_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier public.subscription_tier NOT NULL,
    market public.lead_market NOT NULL,
    allocation_weight numeric(4,3) DEFAULT 0.500 NOT NULL,
    daily_lead_cap integer DEFAULT 5 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    priority_order integer DEFAULT 100 NOT NULL,
    seat_cap integer,
    plan_price_inr integer,
    CONSTRAINT pme_weight_range CHECK (((allocation_weight >= (0)::numeric) AND (allocation_weight <= (1)::numeric)))
);


--
-- Name: COLUMN plan_market_entitlements.priority_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_market_entitlements.priority_order IS 'Lower runs first in PRIORITY pool mode. Ignored in WEIGHTED mode.';


--
-- Name: COLUMN plan_market_entitlements.seat_cap; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.plan_market_entitlements.seat_cap IS 'Sales limit: how many pandits may hold this plan. NEVER used to filter the distribution — a pandit above the cap has still paid and must still be shown.';


--
-- Name: platform_analytics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    total_users integer DEFAULT 0,
    new_users integer DEFAULT 0,
    active_users integer DEFAULT 0,
    total_pandits integer DEFAULT 0,
    new_pandits integer DEFAULT 0,
    total_temples integer DEFAULT 0,
    total_inquiries integer DEFAULT 0,
    total_reviews integer DEFAULT 0,
    total_contact_clicks integer DEFAULT 0,
    total_revenue numeric(12,2) DEFAULT 0,
    active_subscriptions integer DEFAULT 0,
    page_views bigint DEFAULT 0,
    unique_visitors bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    description character varying(500),
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: qualified_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qualified_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pandit_id uuid NOT NULL,
    user_id uuid NOT NULL,
    first_contact_method public.contact_method NOT NULL,
    last_contact_method public.contact_method NOT NULL,
    interaction_count integer DEFAULT 1 NOT NULL,
    status public.lead_status DEFAULT 'new'::public.lead_status NOT NULL,
    source character varying(60),
    contact_name_snapshot character varying(150),
    contact_phone_snapshot character varying(15),
    dedup_window_ends_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_interaction_at timestamp with time zone DEFAULT now() NOT NULL,
    status_changed_at timestamp with time zone,
    market public.lead_market,
    market_source public.market_source,
    temple_id uuid,
    service_id uuid,
    contact_city_snapshot character varying(100),
    contact_state_snapshot character varying(100),
    CONSTRAINT qualified_leads_interaction_count_positive CHECK ((interaction_count > 0))
);


--
-- Name: COLUMN qualified_leads.market; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.qualified_leads.market IS 'Which market this lead is credited to. Decides which plan entitlement was consumed.';


--
-- Name: COLUMN qualified_leads.market_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.qualified_leads.market_source IS 'How the market was determined. IP_GEO is low confidence and should be reviewable.';


--
-- Name: COLUMN qualified_leads.contact_city_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.qualified_leads.contact_city_snapshot IS 'Snapshot of users.city at lead-creation time. Needed because RLS on users does not grant a pandit session SELECT on an arbitrary devotee row — see migration 27 for why the live JOIN alone silently returns NULL.';


--
-- Name: COLUMN qualified_leads.contact_state_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.qualified_leads.contact_state_snapshot IS 'Snapshot of users.state at lead-creation time. Same reason as contact_city_snapshot.';


--
-- Name: recommend_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recommend_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    keywords text[] NOT NULL,
    service_slugs text[] NOT NULL,
    why text NOT NULL
);


--
-- Name: review_helpfulness; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_helpfulness (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_helpful boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reviewable_type public.reviewable_type NOT NULL,
    reviewable_id uuid,
    rating smallint NOT NULL,
    title character varying(200),
    body text,
    photo_urls text[],
    video_url text,
    service_id uuid,
    ceremony_date date,
    is_verified boolean DEFAULT false,
    is_approved boolean DEFAULT true,
    is_flagged boolean DEFAULT false,
    flag_reason character varying(300),
    helpful_count integer DEFAULT 0,
    response_text text,
    response_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT reviews_target_shape CHECK (((((reviewable_type)::text = 'platform'::text) AND (reviewable_id IS NULL)) OR (((reviewable_type)::text <> 'platform'::text) AND (reviewable_id IS NOT NULL))))
);


--
-- Name: COLUMN reviews.reviewable_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reviews.reviewable_id IS 'pandit.id or temple.id. NULL for a platform review.';


--
-- Name: saved_pandits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_pandits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    pandit_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_temples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_temples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    temple_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: security_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_audit_log (
    id bigint NOT NULL,
    event_type character varying(100) NOT NULL,
    severity character varying(20) NOT NULL,
    user_id uuid,
    ip_address inet,
    user_agent text,
    request_path character varying(500),
    request_method character varying(10),
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: security_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.security_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: security_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.security_audit_log_id_seq OWNED BY public.security_audit_log.id;


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    slug character varying(200) NOT NULL,
    description text,
    icon_name character varying(100),
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text,
    tagline character varying(160),
    home_rank integer,
    image_key text
);


--
-- Name: COLUMN service_categories.image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_categories.image_url IS 'Tile image for the "Most booked services" strip.';


--
-- Name: COLUMN service_categories.home_rank; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_categories.home_rank IS 'Lower = earlier in the Most-booked strip. NULL = hidden from it.';


--
-- Name: COLUMN service_categories.image_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_categories.image_key IS 'Raw S3 object key, NULL for pre-migration/local-disk rows. image_url remains authoritative for display.';


--
-- Name: service_samagri; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_samagri (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    item_name character varying(200) NOT NULL,
    item_name_hindi character varying(200),
    quantity character varying(100),
    is_essential boolean DEFAULT true,
    display_order integer DEFAULT 0,
    store_link text
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    slug character varying(250) NOT NULL,
    description text,
    short_description character varying(500),
    icon_name character varying(100),
    image_url text,
    estimated_duration character varying(100),
    difficulty_level character varying(50),
    samagri_list jsonb DEFAULT '[]'::jsonb,
    recommended_muhurat text,
    recommended_tithi text[],
    meta_title character varying(200),
    meta_description character varying(500),
    is_popular boolean DEFAULT false,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    benefits jsonb DEFAULT '[]'::jsonb NOT NULL,
    process jsonb DEFAULT '[]'::jsonb NOT NULL,
    faqs jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_online_available boolean DEFAULT false NOT NULL,
    online_note character varying(300),
    image_key text
);


--
-- Name: COLUMN services.benefits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.benefits IS 'Ordered [{title, detail}] shown on the service detail page.';


--
-- Name: COLUMN services.process; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.process IS 'Ordered [{step, title, detail, duration}] — the vidhi timeline.';


--
-- Name: COLUMN services.faqs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.faqs IS 'Ordered [{q, a}] rendered as the FAQ accordion.';


--
-- Name: COLUMN services.is_online_available; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.is_online_available IS 'Ritual can be performed remotely (video call / live stream).';


--
-- Name: COLUMN services.online_note; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.online_note IS 'How the online version works — shown on the service page.';


--
-- Name: COLUMN services.image_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.services.image_key IS 'Raw S3 object key, NULL for pre-migration/local-disk rows. image_url remains authoritative for display.';


--
-- Name: site_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_images (
    slot_key character varying(64) NOT NULL,
    image_url text NOT NULL,
    image_key text,
    alt_text character varying(200),
    mime_type character varying(50),
    file_size_bytes bigint,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE site_images; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.site_images IS 'One admin-uploaded image per page slot; keys defined in src/config/siteImageSlots.js.';


--
-- Name: COLUMN site_images.slot_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.site_images.slot_key IS 'e.g. home.trust, pandits.hero, services.fallback_puja.';


--
-- Name: stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stats (
    icon character varying(100) NOT NULL,
    number_label character varying(50) NOT NULL,
    label character varying(150) NOT NULL,
    display_order integer NOT NULL
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    tier public.subscription_tier NOT NULL,
    price_monthly numeric(10,2) NOT NULL,
    price_quarterly numeric(10,2),
    price_yearly numeric(10,2),
    currency character varying(3) DEFAULT 'INR'::character varying,
    features jsonb NOT NULL,
    max_temple_listings integer DEFAULT 1,
    max_service_listings integer DEFAULT 5,
    max_photos integer DEFAULT 5,
    is_popular boolean DEFAULT false,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    tagline character varying(160),
    lead_credits_monthly integer
);


--
-- Name: COLUMN subscription_plans.features; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.subscription_plans.features IS 'JSON array of inclusion strings shown on the plan card, e.g. ["Verified badge","Priority listing"].';


--
-- Name: subscription_reminder_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_reminder_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    offset_days integer NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE subscription_reminder_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.subscription_reminder_log IS 'One row per (subscription, offset) reminder actually sent — the dedup guard for services/billing/reminderScheduler.js. No RLS: only ever touched by that scheduler and never exposed on any pandit- or admin-facing read endpoint today.';


--
-- Name: taxonomy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.taxonomy (
    kind character varying(20) NOT NULL,
    value character varying(150) NOT NULL,
    display_order integer NOT NULL
);


--
-- Name: temple_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temple_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    temple_id uuid NOT NULL,
    media_url text NOT NULL,
    media_type public.media_type NOT NULL,
    title character varying(200),
    caption character varying(500),
    display_order integer DEFAULT 0,
    is_cover boolean DEFAULT false,
    file_size_bytes bigint,
    mime_type character varying(50),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    show_in_hero boolean DEFAULT true NOT NULL,
    media_key text
);


--
-- Name: COLUMN temple_media.is_cover; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temple_media.is_cover IS 'The temple profile picture — used for list cards, search results and social previews. Photos only; at most one per temple (uq_temple_media_one_cover).';


--
-- Name: COLUMN temple_media.show_in_hero; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temple_media.show_in_hero IS 'Item appears in the temple page hero slider. Photos and videos both allowed. Opt-out: TRUE by default.';


--
-- Name: COLUMN temple_media.media_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temple_media.media_key IS 'Raw S3 object key, NULL for pre-migration/local-disk rows. media_url remains authoritative for display.';


--
-- Name: temple_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temple_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    temple_id uuid NOT NULL,
    service_id uuid NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: temple_timings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temple_timings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    temple_id uuid NOT NULL,
    day public.day_of_week NOT NULL,
    morning_open time without time zone,
    morning_close time without time zone,
    evening_open time without time zone,
    evening_close time without time zone,
    is_closed boolean DEFAULT false,
    special_note character varying(300),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: temples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.temples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(300) NOT NULL,
    slug character varying(350) NOT NULL,
    description text,
    short_description character varying(500),
    primary_deity character varying(150),
    secondary_deities text[],
    temple_type character varying(100),
    architectural_style character varying(100),
    address_line1 character varying(300) NOT NULL,
    address_line2 character varying(300),
    city character varying(100) NOT NULL,
    district character varying(100),
    state character varying(100) NOT NULL,
    country character varying(100) DEFAULT 'India'::character varying,
    pincode character varying(10),
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    phone character varying(15),
    email character varying(255),
    website character varying(500),
    cover_image_url text,
    thumbnail_url text,
    virtual_tour_url text,
    established_year integer,
    history text,
    significance text,
    how_to_reach text,
    nearest_railway character varying(200),
    nearest_airport character varying(200),
    pandit_count integer DEFAULT 0,
    review_count integer DEFAULT 0,
    avg_rating numeric(3,2) DEFAULT 0.00,
    total_views bigint DEFAULT 0,
    is_verified boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    is_active boolean DEFAULT true,
    managed_by uuid,
    meta_title character varying(200),
    meta_description character varying(500),
    meta_keywords text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    highlights jsonb DEFAULT '[]'::jsonb NOT NULL,
    custom_services jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT temples_custom_services_shape CHECK ((jsonb_typeof(custom_services) = 'array'::text))
);


--
-- Name: COLUMN temples.established_year; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temples.established_year IS 'Year the temple was established, shown in the Overview fact cards.';


--
-- Name: COLUMN temples.significance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temples.significance IS 'Religious significance prose, shown beneath history on the temple page.';


--
-- Name: COLUMN temples.highlights; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temples.highlights IS 'Ordered array of strings rendered as "Highlights & special sevas".';


--
-- Name: COLUMN temples.custom_services; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.temples.custom_services IS 'Temple-specific rituals not in the services catalogue. Ordered array of {name, description}. Rendered in "Services performed here"; tapping one opens the enquiry form because it has no detail page.';


--
-- Name: universal_faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.universal_faqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    entity_type character varying(20) DEFAULT 'GLOBAL'::character varying NOT NULL,
    entity_id uuid,
    slug character varying(220),
    status public.content_status DEFAULT 'draft'::public.content_status NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT universal_faqs_entity_type_check CHECK (((entity_type)::text = ANY ((ARRAY['GLOBAL'::character varying, 'HOME'::character varying, 'TEMPLE'::character varying, 'SERVICE'::character varying, 'PANDIT'::character varying])::text[])))
);


--
-- Name: user_activity_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_key character varying(64),
    pandit_id uuid,
    event_type public.activity_event_type NOT NULL,
    source_surface public.activity_source_surface,
    temple_id uuid,
    service_id uuid,
    country character varying(2),
    region character varying(80),
    city character varying(100),
    market public.lead_market,
    location_source character varying(20),
    qualified_lead_id uuid,
    device_type character varying(20),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    device_info jsonb,
    ip_address inet,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: v_pandit_dashboard; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pandit_dashboard AS
SELECT
    NULL::uuid AS pandit_id,
    NULL::uuid AS user_id,
    NULL::character varying(150) AS full_name,
    NULL::public.subscription_tier AS current_tier,
    NULL::public.verification_status AS verification_status,
    NULL::numeric(3,2) AS avg_rating,
    NULL::integer AS review_count,
    NULL::bigint AS total_profile_views,
    NULL::bigint AS total_contact_clicks,
    NULL::bigint AS total_whatsapp_clicks,
    NULL::bigint AS total_call_clicks,
    NULL::character varying(20) AS billing_cycle,
    NULL::timestamp with time zone AS subscription_expires,
    NULL::boolean AS subscription_active,
    NULL::character varying(100) AS plan_name,
    NULL::bigint AS views_30d,
    NULL::bigint AS whatsapp_30d,
    NULL::bigint AS calls_30d,
    NULL::bigint AS inquiries_30d,
    NULL::bigint AS pending_inquiries;


--
-- Name: v_pandit_search; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pandit_search AS
SELECT
    NULL::uuid AS id,
    NULL::character varying(200) AS slug,
    NULL::character varying(50) AS title,
    NULL::character varying(150) AS full_name,
    NULL::character varying(100) AS city,
    NULL::character varying(100) AS state,
    NULL::numeric(10,8) AS latitude,
    NULL::numeric(11,8) AS longitude,
    NULL::text AS profile_photo_url,
    NULL::character varying(300) AS short_bio,
    NULL::integer AS experience_years,
    NULL::numeric(3,2) AS avg_rating,
    NULL::integer AS review_count,
    NULL::public.verification_status AS verification_status,
    NULL::public.subscription_tier AS current_tier,
    NULL::boolean AS is_featured,
    NULL::boolean AS is_available,
    NULL::numeric(10,4) AS rank_score,
    NULL::character varying(15) AS whatsapp_number,
    NULL::character varying(15) AS public_phone,
    NULL::boolean AS has_video_intro,
    NULL::character varying[] AS languages,
    NULL::text[] AS specializations,
    NULL::bigint AS temple_count,
    NULL::bigint AS service_count;


--
-- Name: v_temple_search; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_temple_search AS
 SELECT id,
    slug,
    name,
    short_description,
    primary_deity,
    temple_type,
    city,
    district,
    state,
    latitude,
    longitude,
    cover_image_url,
    thumbnail_url,
    pandit_count,
    review_count,
    avg_rating,
    is_verified,
    is_featured,
    ( SELECT count(*) AS count
           FROM public.temple_services ts
          WHERE ((ts.temple_id = t.id) AND (ts.is_active = true))) AS service_count,
    ( SELECT count(*) AS count
           FROM public.temple_media tm
          WHERE (tm.temple_id = t.id)) AS media_count
   FROM public.temples t
  WHERE ((is_active = true) AND (deleted_at IS NULL));


--
-- Name: visitor_geo_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitor_geo_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_key character varying(64),
    user_id uuid,
    detected_country_code character varying(2),
    detected_region character varying(80),
    detection_source character varying(30),
    selected_country_code character varying(2),
    resolved_market public.lead_market,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(30) DEFAULT 'razorpay'::character varying NOT NULL,
    event_type character varying(60) NOT NULL,
    dedupe_key character varying(200) NOT NULL,
    payload jsonb,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processing_status character varying(20) DEFAULT 'received'::character varying NOT NULL,
    attempt_count integer DEFAULT 1 NOT NULL,
    error_message text
);


--
-- Name: TABLE webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.webhook_events IS 'Every inbound Razorpay webhook call, keyed by a deterministic (event_type, entity id) dedupe key. Only ever touched server-side by the webhook handler — no RLS, no pandit- or admin-facing endpoint reads this today.';


--
-- Name: admin_activity_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log ALTER COLUMN id SET DEFAULT nextval('public.admin_activity_log_id_seq'::regclass);


--
-- Name: honeypot_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.honeypot_logs ALTER COLUMN id SET DEFAULT nextval('public.honeypot_logs_id_seq'::regclass);


--
-- Name: security_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_log ALTER COLUMN id SET DEFAULT nextval('public.security_audit_log_id_seq'::regclass);


--
-- Name: admin_activity_log admin_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id);


--
-- Name: admin_mfa_challenges admin_mfa_challenges_challenge_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_mfa_challenges
    ADD CONSTRAINT admin_mfa_challenges_challenge_token_hash_key UNIQUE (challenge_token_hash);


--
-- Name: admin_mfa_challenges admin_mfa_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_mfa_challenges
    ADD CONSTRAINT admin_mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: admin_sessions admin_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_pkey PRIMARY KEY (id);


--
-- Name: admin_sessions admin_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_feedback ai_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_chunks ai_knowledge_chunks_document_id_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT ai_knowledge_chunks_document_id_chunk_index_key UNIQUE (document_id, chunk_index);


--
-- Name: ai_knowledge_chunks ai_knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT ai_knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_documents ai_knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_documents
    ADD CONSTRAINT ai_knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_problem_categories ai_problem_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_problem_categories
    ADD CONSTRAINT ai_problem_categories_pkey PRIMARY KEY (id);


--
-- Name: ai_problem_categories ai_problem_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_problem_categories
    ADD CONSTRAINT ai_problem_categories_slug_key UNIQUE (slug);


--
-- Name: ai_problem_service_mappings ai_problem_service_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_problem_service_mappings
    ADD CONSTRAINT ai_problem_service_mappings_pkey PRIMARY KEY (id);


--
-- Name: ai_problem_service_mappings ai_problem_service_mappings_problem_category_id_service_id__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_problem_service_mappings
    ADD CONSTRAINT ai_problem_service_mappings_problem_category_id_service_id__key UNIQUE (problem_category_id, service_id, temple_id);


--
-- Name: ai_query_analytics ai_query_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_query_analytics
    ADD CONSTRAINT ai_query_analytics_pkey PRIMARY KEY (id);


--
-- Name: ai_ranking_config ai_ranking_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ranking_config
    ADD CONSTRAINT ai_ranking_config_pkey PRIMARY KEY (key);


--
-- Name: ai_recommendation_events ai_recommendation_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendation_events
    ADD CONSTRAINT ai_recommendation_events_pkey PRIMARY KEY (id);


--
-- Name: ai_recommendations ai_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_pkey PRIMARY KEY (id);


--
-- Name: banned_ips banned_ips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banned_ips
    ADD CONSTRAINT banned_ips_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: community_comments community_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_comments
    ADD CONSTRAINT community_comments_pkey PRIMARY KEY (id);


--
-- Name: community_posts community_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_pkey PRIMARY KEY (id);


--
-- Name: contact_clicks contact_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_clicks
    ADD CONSTRAINT contact_clicks_pkey PRIMARY KEY (id);


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_messages
    ADD CONSTRAINT contact_messages_pkey PRIMARY KEY (id);


--
-- Name: deployment_environment deployment_environment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deployment_environment
    ADD CONSTRAINT deployment_environment_pkey PRIMARY KEY (id);


--
-- Name: distribution_config_audit distribution_config_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribution_config_audit
    ADD CONSTRAINT distribution_config_audit_pkey PRIMARY KEY (id);


--
-- Name: distribution_config distribution_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribution_config
    ADD CONSTRAINT distribution_config_pkey PRIMARY KEY (key);


--
-- Name: universal_faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universal_faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: home_hero_images home_hero_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_hero_images
    ADD CONSTRAINT home_hero_images_pkey PRIMARY KEY (id);


--
-- Name: honeypot_logs honeypot_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.honeypot_logs
    ADD CONSTRAINT honeypot_logs_pkey PRIMARY KEY (id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: newsletter_subscribers newsletter_subscribers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: pandit_analytics pandit_analytics_pandit_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_analytics
    ADD CONSTRAINT pandit_analytics_pandit_id_date_key UNIQUE (pandit_id, date);


--
-- Name: pandit_analytics pandit_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_analytics
    ADD CONSTRAINT pandit_analytics_pkey PRIMARY KEY (id);


--
-- Name: pandit_availability pandit_availability_pandit_id_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_availability
    ADD CONSTRAINT pandit_availability_pandit_id_day_key UNIQUE (pandit_id, day);


--
-- Name: pandit_availability pandit_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_availability
    ADD CONSTRAINT pandit_availability_pkey PRIMARY KEY (id);


--
-- Name: pandit_blocked_dates pandit_blocked_dates_pandit_id_blocked_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_blocked_dates
    ADD CONSTRAINT pandit_blocked_dates_pandit_id_blocked_date_key UNIQUE (pandit_id, blocked_date);


--
-- Name: pandit_blocked_dates pandit_blocked_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_blocked_dates
    ADD CONSTRAINT pandit_blocked_dates_pkey PRIMARY KEY (id);


--
-- Name: pandit_certificates pandit_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_certificates
    ADD CONSTRAINT pandit_certificates_pkey PRIMARY KEY (id);


--
-- Name: pandit_exposure pandit_exposure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_exposure
    ADD CONSTRAINT pandit_exposure_pkey PRIMARY KEY (id);


--
-- Name: pandit_languages pandit_languages_pandit_id_language_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_languages
    ADD CONSTRAINT pandit_languages_pandit_id_language_key UNIQUE (pandit_id, language);


--
-- Name: pandit_languages pandit_languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_languages
    ADD CONSTRAINT pandit_languages_pkey PRIMARY KEY (id);


--
-- Name: pandit_media pandit_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_media
    ADD CONSTRAINT pandit_media_pkey PRIMARY KEY (id);


--
-- Name: pandit_services pandit_services_pandit_id_service_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_services
    ADD CONSTRAINT pandit_services_pandit_id_service_id_key UNIQUE (pandit_id, service_id);


--
-- Name: pandit_services pandit_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_services
    ADD CONSTRAINT pandit_services_pkey PRIMARY KEY (id);


--
-- Name: pandit_subscriptions pandit_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_subscriptions
    ADD CONSTRAINT pandit_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: pandit_temples pandit_temples_pandit_id_temple_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_temples
    ADD CONSTRAINT pandit_temples_pandit_id_temple_id_key UNIQUE (pandit_id, temple_id);


--
-- Name: pandit_temples pandit_temples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_temples
    ADD CONSTRAINT pandit_temples_pkey PRIMARY KEY (id);


--
-- Name: pandits pandits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandits
    ADD CONSTRAINT pandits_pkey PRIMARY KEY (id);


--
-- Name: pandits pandits_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandits
    ADD CONSTRAINT pandits_slug_key UNIQUE (slug);


--
-- Name: pandits pandits_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandits
    ADD CONSTRAINT pandits_user_id_key UNIQUE (user_id);


--
-- Name: password_reset_challenges password_reset_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_challenges
    ADD CONSTRAINT password_reset_challenges_pkey PRIMARY KEY (id);


--
-- Name: password_reset_challenges password_reset_challenges_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_challenges
    ADD CONSTRAINT password_reset_challenges_token_hash_key UNIQUE (token_hash);


--
-- Name: payment_transactions payment_transactions_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_invoice_number_key UNIQUE (invoice_number);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: plan_market_entitlements plan_market_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_market_entitlements
    ADD CONSTRAINT plan_market_entitlements_pkey PRIMARY KEY (id);


--
-- Name: plan_market_entitlements plan_market_entitlements_tier_market_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_market_entitlements
    ADD CONSTRAINT plan_market_entitlements_tier_market_key UNIQUE (tier, market);


--
-- Name: platform_analytics platform_analytics_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_analytics
    ADD CONSTRAINT platform_analytics_date_key UNIQUE (date);


--
-- Name: platform_analytics platform_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_analytics
    ADD CONSTRAINT platform_analytics_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: qualified_leads qualified_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qualified_leads
    ADD CONSTRAINT qualified_leads_pkey PRIMARY KEY (id);


--
-- Name: recommend_rules recommend_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recommend_rules
    ADD CONSTRAINT recommend_rules_pkey PRIMARY KEY (id);


--
-- Name: review_helpfulness review_helpfulness_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpfulness
    ADD CONSTRAINT review_helpfulness_pkey PRIMARY KEY (id);


--
-- Name: review_helpfulness review_helpfulness_review_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpfulness
    ADD CONSTRAINT review_helpfulness_review_id_user_id_key UNIQUE (review_id, user_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: saved_pandits saved_pandits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_pandits
    ADD CONSTRAINT saved_pandits_pkey PRIMARY KEY (id);


--
-- Name: saved_pandits saved_pandits_user_id_pandit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_pandits
    ADD CONSTRAINT saved_pandits_user_id_pandit_id_key UNIQUE (user_id, pandit_id);


--
-- Name: saved_temples saved_temples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_temples
    ADD CONSTRAINT saved_temples_pkey PRIMARY KEY (id);


--
-- Name: saved_temples saved_temples_user_id_temple_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_temples
    ADD CONSTRAINT saved_temples_user_id_temple_id_key UNIQUE (user_id, temple_id);


--
-- Name: security_audit_log security_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_log
    ADD CONSTRAINT security_audit_log_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_name_key UNIQUE (name);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_slug_key UNIQUE (slug);


--
-- Name: service_samagri service_samagri_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_samagri
    ADD CONSTRAINT service_samagri_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: services services_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_slug_key UNIQUE (slug);


--
-- Name: site_images site_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_images
    ADD CONSTRAINT site_images_pkey PRIMARY KEY (slot_key);


--
-- Name: stats stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stats
    ADD CONSTRAINT stats_pkey PRIMARY KEY (display_order);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_tier_key UNIQUE (tier);


--
-- Name: subscription_reminder_log subscription_reminder_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_reminder_log
    ADD CONSTRAINT subscription_reminder_log_pkey PRIMARY KEY (id);


--
-- Name: subscription_reminder_log subscription_reminder_log_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_reminder_log
    ADD CONSTRAINT subscription_reminder_log_unique UNIQUE (subscription_id, offset_days);


--
-- Name: taxonomy taxonomy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taxonomy
    ADD CONSTRAINT taxonomy_pkey PRIMARY KEY (kind, value);


--
-- Name: temple_media temple_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_media
    ADD CONSTRAINT temple_media_pkey PRIMARY KEY (id);


--
-- Name: temple_services temple_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_services
    ADD CONSTRAINT temple_services_pkey PRIMARY KEY (id);


--
-- Name: temple_services temple_services_temple_id_service_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_services
    ADD CONSTRAINT temple_services_temple_id_service_id_key UNIQUE (temple_id, service_id);


--
-- Name: temple_timings temple_timings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_timings
    ADD CONSTRAINT temple_timings_pkey PRIMARY KEY (id);


--
-- Name: temple_timings temple_timings_temple_id_day_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_timings
    ADD CONSTRAINT temple_timings_temple_id_day_key UNIQUE (temple_id, day);


--
-- Name: temples temples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temples
    ADD CONSTRAINT temples_pkey PRIMARY KEY (id);


--
-- Name: temples temples_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temples
    ADD CONSTRAINT temples_slug_key UNIQUE (slug);


--
-- Name: user_activity_events user_activity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_events
    ADD CONSTRAINT user_activity_events_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_facebook_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_facebook_id_key UNIQUE (facebook_id);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visitor_geo_log visitor_geo_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_geo_log
    ADD CONSTRAINT visitor_geo_log_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_provider_dedupe_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_provider_dedupe_key UNIQUE (provider, dedupe_key);


--
-- Name: idx_activity_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_dedup ON public.user_activity_events USING btree (pandit_id, event_type, COALESCE((user_id)::text, (session_key)::text), created_at DESC) WHERE (pandit_id IS NOT NULL);


--
-- Name: idx_activity_pandit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_pandit_created ON public.user_activity_events USING btree (pandit_id, created_at DESC);


--
-- Name: idx_activity_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_session ON public.user_activity_events USING btree (session_key, created_at DESC) WHERE (session_key IS NOT NULL);


--
-- Name: idx_activity_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_type_created ON public.user_activity_events USING btree (event_type, created_at DESC);


--
-- Name: idx_activity_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_user_created ON public.user_activity_events USING btree (user_id, created_at DESC);


--
-- Name: idx_admin_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_log_action ON public.admin_activity_log USING btree (action);


--
-- Name: idx_admin_log_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_log_admin ON public.admin_activity_log USING btree (admin_user_id);


--
-- Name: idx_admin_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_log_created ON public.admin_activity_log USING btree (created_at DESC);


--
-- Name: idx_admin_log_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_log_target ON public.admin_activity_log USING btree (target_type, target_id);


--
-- Name: idx_admin_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_sessions_token ON public.admin_sessions USING btree (token_hash);


--
-- Name: idx_admin_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_sessions_user ON public.admin_sessions USING btree (user_id);


--
-- Name: idx_ai_analytics_gap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_analytics_gap ON public.ai_query_analytics USING btree (gap_type, requested_city, created_at DESC) WHERE (gap_type IS NOT NULL);


--
-- Name: idx_ai_analytics_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_analytics_time ON public.ai_query_analytics USING btree (created_at DESC);


--
-- Name: idx_ai_chunk_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chunk_document ON public.ai_knowledge_chunks USING btree (document_id);


--
-- Name: idx_ai_chunk_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chunk_embedding ON public.ai_knowledge_chunks USING hnsw (embedding public.vector_cosine_ops) WHERE is_retrievable;


--
-- Name: idx_ai_chunk_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chunk_tsv ON public.ai_knowledge_chunks USING gin (content_tsv);


--
-- Name: idx_ai_conv_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_conv_session ON public.ai_conversations USING btree (session_key);


--
-- Name: idx_ai_conv_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_conv_user ON public.ai_conversations USING btree (user_id, last_message_at DESC);


--
-- Name: idx_ai_doc_needs_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_doc_needs_index ON public.ai_knowledge_documents USING btree (updated_at) WHERE (indexed_at IS NULL);


--
-- Name: idx_ai_doc_retrievable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_doc_retrievable ON public.ai_knowledge_documents USING btree (document_type) WHERE (((status)::text = 'published'::text) AND verified);


--
-- Name: idx_ai_doc_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_doc_service ON public.ai_knowledge_documents USING btree (service_id);


--
-- Name: idx_ai_doc_temple; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_doc_temple ON public.ai_knowledge_documents USING btree (temple_id);


--
-- Name: idx_ai_event_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_event_pandit ON public.ai_recommendation_events USING btree (pandit_id, created_at DESC);


--
-- Name: idx_ai_event_type_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_event_type_time ON public.ai_recommendation_events USING btree (event_type, created_at DESC);


--
-- Name: idx_ai_mapping_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_mapping_lookup ON public.ai_problem_service_mappings USING btree (problem_category_id, relevance_score DESC) WHERE ((status)::text = 'published'::text);


--
-- Name: idx_ai_msg_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_msg_conversation ON public.ai_messages USING btree (conversation_id, created_at);


--
-- Name: idx_ai_problem_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_problem_categories_parent ON public.ai_problem_categories USING btree (parent_id);


--
-- Name: idx_ai_recs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_recs_created ON public.ai_recommendations USING btree (created_at DESC);


--
-- Name: idx_ai_recs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_recs_user ON public.ai_recommendations USING btree (user_id);


--
-- Name: idx_analytics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_date ON public.pandit_analytics USING btree (date DESC);


--
-- Name: idx_analytics_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_pandit ON public.pandit_analytics USING btree (pandit_id);


--
-- Name: idx_analytics_pandit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_pandit_date ON public.pandit_analytics USING btree (pandit_id, date DESC);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_created ON public.security_audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_event ON public.security_audit_log USING btree (event_type);


--
-- Name: idx_audit_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_severity ON public.security_audit_log USING btree (severity);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_user ON public.security_audit_log USING btree (user_id);


--
-- Name: idx_banned_ips_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_banned_ips_active ON public.banned_ips USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_banned_ips_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_banned_ips_ip ON public.banned_ips USING btree (ip_address);


--
-- Name: idx_blocked_dates_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_dates_date ON public.pandit_blocked_dates USING btree (blocked_date);


--
-- Name: idx_blocked_dates_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_dates_pandit ON public.pandit_blocked_dates USING btree (pandit_id);


--
-- Name: idx_blog_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_published ON public.blog_posts USING btree (published_at DESC);


--
-- Name: idx_blog_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_search ON public.blog_posts USING gin (to_tsvector('english'::regconfig, (((COALESCE(title, ''::character varying))::text || ' '::text) || COALESCE(body, ''::text))));


--
-- Name: idx_blog_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_slug ON public.blog_posts USING btree (slug);


--
-- Name: idx_blog_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_status ON public.blog_posts USING btree (status);


--
-- Name: idx_comments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_parent ON public.community_comments USING btree (parent_id);


--
-- Name: idx_comments_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_comments_post ON public.community_comments USING btree (post_id);


--
-- Name: idx_community_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_community_category ON public.community_posts USING btree (category);


--
-- Name: idx_community_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_community_created ON public.community_posts USING btree (created_at DESC);


--
-- Name: idx_community_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_community_user ON public.community_posts USING btree (user_id);


--
-- Name: idx_contact_clicks_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_clicks_created ON public.contact_clicks USING btree (created_at DESC);


--
-- Name: idx_contact_clicks_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_clicks_method ON public.contact_clicks USING btree (contact_method);


--
-- Name: idx_contact_clicks_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_clicks_pandit ON public.contact_clicks USING btree (pandit_id);


--
-- Name: idx_contact_clicks_pandit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_clicks_pandit_created ON public.contact_clicks USING btree (pandit_id, created_at DESC);


--
-- Name: idx_contact_clicks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_clicks_user ON public.contact_clicks USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_dist_audit_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_dist_audit_recent ON public.distribution_config_audit USING btree (changed_at DESC);


--
-- Name: idx_exposure_pool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exposure_pool ON public.pandit_exposure USING btree (pandit_id, market, temple_id, created_at DESC);


--
-- Name: idx_exposure_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exposure_recent ON public.pandit_exposure USING btree (created_at DESC);


--
-- Name: idx_home_hero_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_home_hero_order ON public.home_hero_images USING btree (display_order) WHERE (is_active = true);


--
-- Name: idx_honeypot_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_honeypot_created ON public.honeypot_logs USING btree (created_at DESC);


--
-- Name: idx_honeypot_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_honeypot_ip ON public.honeypot_logs USING btree (ip_address);


--
-- Name: idx_inquiries_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_created ON public.inquiries USING btree (created_at DESC);


--
-- Name: idx_inquiries_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_pandit ON public.inquiries USING btree (pandit_id);


--
-- Name: idx_inquiries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_status ON public.inquiries USING btree (status);


--
-- Name: idx_inquiries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inquiries_user ON public.inquiries USING btree (user_id);


--
-- Name: idx_mfa_challenge_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfa_challenge_token ON public.admin_mfa_challenges USING btree (challenge_token_hash);


--
-- Name: idx_notif_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notif_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_type ON public.notifications USING btree (type);


--
-- Name: idx_notif_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_unread ON public.notifications USING btree (user_id, is_read) WHERE (is_read = false);


--
-- Name: idx_notif_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_user ON public.notifications USING btree (user_id);


--
-- Name: idx_otp_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_target ON public.otp_verifications USING btree (target, target_type);


--
-- Name: idx_pandit_avail_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_avail_pandit ON public.pandit_availability USING btree (pandit_id);


--
-- Name: idx_pandit_certs_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_certs_pandit ON public.pandit_certificates USING btree (pandit_id);


--
-- Name: idx_pandit_languages_lang; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_languages_lang ON public.pandit_languages USING btree (language);


--
-- Name: idx_pandit_languages_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_languages_pandit ON public.pandit_languages USING btree (pandit_id);


--
-- Name: idx_pandit_media_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_media_pandit ON public.pandit_media USING btree (pandit_id);


--
-- Name: idx_pandit_services_online; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_services_online ON public.pandit_services USING btree (service_id, pandit_id) WHERE (offers_online = true);


--
-- Name: idx_pandit_services_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_services_pandit ON public.pandit_services USING btree (pandit_id);


--
-- Name: idx_pandit_services_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_services_service ON public.pandit_services USING btree (service_id);


--
-- Name: idx_pandit_subs_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_subs_active ON public.pandit_subscriptions USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_pandit_subs_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_subs_expires ON public.pandit_subscriptions USING btree (expires_at);


--
-- Name: idx_pandit_subs_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_subs_pandit ON public.pandit_subscriptions USING btree (pandit_id);


--
-- Name: idx_pandit_temples_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_temples_pandit ON public.pandit_temples USING btree (pandit_id);


--
-- Name: idx_pandit_temples_temple; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandit_temples_temple ON public.pandit_temples USING btree (temple_id);


--
-- Name: idx_pandits_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_available ON public.pandits USING btree (is_available) WHERE (is_available = true);


--
-- Name: idx_pandits_experience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_experience ON public.pandits USING btree (experience_years DESC);


--
-- Name: idx_pandits_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_featured ON public.pandits USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_pandits_is_paused; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_is_paused ON public.pandits USING btree (is_paused) WHERE (is_paused = true);


--
-- Name: idx_pandits_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_rank ON public.pandits USING btree (rank_score DESC);


--
-- Name: idx_pandits_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_rating ON public.pandits USING btree (avg_rating DESC);


--
-- Name: idx_pandits_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_search ON public.pandits USING gin (to_tsvector('english'::regconfig, ((COALESCE(bio, ''::text) || ' '::text) || (COALESCE(primary_specialization, ''::character varying))::text)));


--
-- Name: idx_pandits_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_slug ON public.pandits USING btree (slug);


--
-- Name: idx_pandits_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_tier ON public.pandits USING btree (current_tier);


--
-- Name: idx_pandits_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_user ON public.pandits USING btree (user_id);


--
-- Name: idx_pandits_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pandits_verification ON public.pandits USING btree (verification_status);


--
-- Name: idx_payments_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_created ON public.payment_transactions USING btree (created_at DESC);


--
-- Name: idx_payments_gateway; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_gateway ON public.payment_transactions USING btree (gateway_payment_id);


--
-- Name: idx_payments_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_pandit ON public.payment_transactions USING btree (pandit_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payment_transactions USING btree (status);


--
-- Name: idx_platform_analytics_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_analytics_date ON public.platform_analytics USING btree (date DESC);


--
-- Name: idx_qleads_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qleads_dedup ON public.qualified_leads USING btree (pandit_id, user_id, dedup_window_ends_at DESC);


--
-- Name: idx_qleads_method; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qleads_method ON public.qualified_leads USING btree (pandit_id, first_contact_method);


--
-- Name: idx_qleads_pandit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qleads_pandit_created ON public.qualified_leads USING btree (pandit_id, created_at DESC);


--
-- Name: idx_qleads_pool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qleads_pool ON public.qualified_leads USING btree (pandit_id, market, created_at DESC);


--
-- Name: idx_qleads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qleads_status ON public.qualified_leads USING btree (pandit_id, status);


--
-- Name: idx_qleads_user_pandit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qleads_user_pandit_created ON public.qualified_leads USING btree (user_id, pandit_id, created_at DESC);


--
-- Name: idx_reset_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reset_expires ON public.password_reset_challenges USING btree (expires_at);


--
-- Name: idx_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reset_token ON public.password_reset_challenges USING btree (token_hash);


--
-- Name: idx_reset_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reset_user ON public.password_reset_challenges USING btree (user_id);


--
-- Name: idx_reviews_approved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_approved ON public.reviews USING btree (is_approved) WHERE (is_approved = true);


--
-- Name: idx_reviews_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_created ON public.reviews USING btree (created_at DESC);


--
-- Name: idx_reviews_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_rating ON public.reviews USING btree (rating);


--
-- Name: idx_reviews_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_target ON public.reviews USING btree (reviewable_type, reviewable_id);


--
-- Name: idx_reviews_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_user ON public.reviews USING btree (user_id);


--
-- Name: idx_samagri_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samagri_service ON public.service_samagri USING btree (service_id);


--
-- Name: idx_saved_pandits_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_pandits_user ON public.saved_pandits USING btree (user_id);


--
-- Name: idx_saved_temples_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_saved_temples_user ON public.saved_temples USING btree (user_id);


--
-- Name: idx_service_categories_home; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_categories_home ON public.service_categories USING btree (home_rank) WHERE (home_rank IS NOT NULL);


--
-- Name: idx_services_benefits; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_benefits ON public.services USING gin (benefits);


--
-- Name: idx_services_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_category ON public.services USING btree (category_id);


--
-- Name: idx_services_online; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_online ON public.services USING btree (is_online_available) WHERE (is_online_available = true);


--
-- Name: idx_services_popular; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_popular ON public.services USING btree (is_popular) WHERE (is_popular = true);


--
-- Name: idx_services_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_search ON public.services USING gin (to_tsvector('english'::regconfig, (((COALESCE(name, ''::character varying))::text || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_services_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_services_slug ON public.services USING btree (slug);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_expires ON public.user_sessions USING btree (expires_at);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.user_sessions USING btree (token_hash);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user ON public.user_sessions USING btree (user_id);


--
-- Name: idx_subscription_reminder_log_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_reminder_log_sub ON public.subscription_reminder_log USING btree (subscription_id);


--
-- Name: idx_temple_media_hero; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temple_media_hero ON public.temple_media USING btree (temple_id, display_order) WHERE show_in_hero;


--
-- Name: idx_temple_media_temple; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temple_media_temple ON public.temple_media USING btree (temple_id);


--
-- Name: idx_temple_media_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temple_media_type ON public.temple_media USING btree (media_type);


--
-- Name: idx_temple_services_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temple_services_service ON public.temple_services USING btree (service_id);


--
-- Name: idx_temple_services_temple; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temple_services_temple ON public.temple_services USING btree (temple_id);


--
-- Name: idx_temple_timings_temple; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temple_timings_temple ON public.temple_timings USING btree (temple_id);


--
-- Name: idx_temples_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_active ON public.temples USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_temples_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_city ON public.temples USING btree (city);


--
-- Name: idx_temples_city_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_city_state ON public.temples USING btree (city, state);


--
-- Name: idx_temples_deity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_deity ON public.temples USING btree (primary_deity);


--
-- Name: idx_temples_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_featured ON public.temples USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_temples_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_location ON public.temples USING gist (public.st_makepoint((longitude)::double precision, (latitude)::double precision));


--
-- Name: idx_temples_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_name_trgm ON public.temples USING gin (name public.gin_trgm_ops);


--
-- Name: idx_temples_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_rating ON public.temples USING btree (avg_rating DESC);


--
-- Name: idx_temples_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_search ON public.temples USING gin (to_tsvector('english'::regconfig, (((((COALESCE(name, ''::character varying))::text || ' '::text) || (COALESCE(city, ''::character varying))::text) || ' '::text) || (COALESCE(primary_deity, ''::character varying))::text)));


--
-- Name: idx_temples_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_slug ON public.temples USING btree (slug);


--
-- Name: idx_temples_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_state ON public.temples USING btree (state);


--
-- Name: idx_temples_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_temples_type ON public.temples USING btree (temple_type);


--
-- Name: idx_universal_faqs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_universal_faqs_entity ON public.universal_faqs USING btree (entity_type, entity_id);


--
-- Name: idx_universal_faqs_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_universal_faqs_sort ON public.universal_faqs USING btree (entity_type, entity_id, sort_order);


--
-- Name: idx_universal_faqs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_universal_faqs_status ON public.universal_faqs USING btree (status);


--
-- Name: idx_users_city_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_city_state ON public.users USING btree (city, state);


--
-- Name: idx_users_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_location ON public.users USING gist (public.st_makepoint((longitude)::double precision, (latitude)::double precision));


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_visitor_geo_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visitor_geo_session ON public.visitor_geo_log USING btree (session_key, created_at DESC);


--
-- Name: idx_webhook_events_received; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_received ON public.webhook_events USING btree (received_at DESC);


--
-- Name: idx_webhook_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_status ON public.webhook_events USING btree (processing_status);


--
-- Name: uq_ai_doc_source_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ai_doc_source_ref ON public.ai_knowledge_documents USING btree (source, source_ref) WHERE (source_ref IS NOT NULL);


--
-- Name: uq_ai_feedback_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ai_feedback_user ON public.ai_feedback USING btree (message_id, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: uq_exposure_session_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_exposure_session_hour ON public.pandit_exposure USING btree (pandit_id, session_key, market, date_trunc('hour'::text, (created_at AT TIME ZONE 'UTC'::text))) WHERE (session_key IS NOT NULL);


--
-- Name: uq_payment_gateway_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_payment_gateway_order_id ON public.payment_transactions USING btree (gateway_order_id) WHERE (gateway_order_id IS NOT NULL);


--
-- Name: uq_payment_gateway_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_payment_gateway_payment_id ON public.payment_transactions USING btree (gateway_payment_id) WHERE (gateway_payment_id IS NOT NULL);


--
-- Name: uq_platform_review_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_platform_review_per_user ON public.reviews USING btree (user_id) WHERE ((reviewable_id IS NULL) AND (deleted_at IS NULL));


--
-- Name: uq_review_per_user_target; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_review_per_user_target ON public.reviews USING btree (user_id, reviewable_type, reviewable_id) WHERE ((reviewable_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: uq_subscription_one_active_per_pandit; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_subscription_one_active_per_pandit ON public.pandit_subscriptions USING btree (pandit_id) WHERE is_active;


--
-- Name: uq_temple_media_one_cover; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_temple_media_one_cover ON public.temple_media USING btree (temple_id) WHERE is_cover;


--
-- Name: uq_universal_faqs_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_universal_faqs_slug ON public.universal_faqs USING btree (entity_type, entity_id, slug) WHERE (slug IS NOT NULL);


--
-- Name: v_pandit_search _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.v_pandit_search AS
 SELECT p.id,
    p.slug,
    p.title,
    u.full_name,
    u.city,
    u.state,
    u.latitude,
    u.longitude,
    p.profile_photo_url,
    p.short_bio,
    p.experience_years,
    p.avg_rating,
    p.review_count,
    p.verification_status,
    p.current_tier,
    p.is_featured,
    p.is_available,
    p.rank_score,
    p.whatsapp_number,
    p.public_phone,
    (p.video_intro_url IS NOT NULL) AS has_video_intro,
    array_agg(DISTINCT pl.language) FILTER (WHERE (pl.language IS NOT NULL)) AS languages,
    p.specializations,
    ( SELECT count(*) AS count
           FROM public.pandit_temples pt
          WHERE ((pt.pandit_id = p.id) AND (pt.is_active = true))) AS temple_count,
    ( SELECT count(*) AS count
           FROM public.pandit_services ps
          WHERE ((ps.pandit_id = p.id) AND (ps.is_active = true))) AS service_count
   FROM ((public.pandits p
     JOIN public.users u ON ((p.user_id = u.id)))
     LEFT JOIN public.pandit_languages pl ON ((p.id = pl.pandit_id)))
  WHERE ((u.status = 'active'::public.account_status) AND (p.deleted_at IS NULL) AND (u.deleted_at IS NULL))
  GROUP BY p.id, u.id;


--
-- Name: v_pandit_dashboard _RETURN; Type: RULE; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW public.v_pandit_dashboard AS
 SELECT p.id AS pandit_id,
    p.user_id,
    u.full_name,
    p.current_tier,
    p.verification_status,
    p.avg_rating,
    p.review_count,
    p.total_profile_views,
    p.total_contact_clicks,
    p.total_whatsapp_clicks,
    p.total_call_clicks,
    ps.billing_cycle,
    ps.expires_at AS subscription_expires,
    ps.is_active AS subscription_active,
    sp.name AS plan_name,
    COALESCE(sum(pa.profile_views), (0)::bigint) AS views_30d,
    COALESCE(sum(pa.whatsapp_clicks), (0)::bigint) AS whatsapp_30d,
    COALESCE(sum(pa.call_clicks), (0)::bigint) AS calls_30d,
    COALESCE(sum(pa.inquiry_count), (0)::bigint) AS inquiries_30d,
    ( SELECT count(*) AS count
           FROM public.inquiries i
          WHERE ((i.pandit_id = p.id) AND (i.status = 'new'::public.inquiry_status))) AS pending_inquiries
   FROM ((((public.pandits p
     JOIN public.users u ON ((p.user_id = u.id)))
     LEFT JOIN public.pandit_subscriptions ps ON (((p.id = ps.pandit_id) AND (ps.is_active = true))))
     LEFT JOIN public.subscription_plans sp ON ((ps.plan_id = sp.id)))
     LEFT JOIN public.pandit_analytics pa ON (((p.id = pa.pandit_id) AND (pa.date >= (CURRENT_DATE - '30 days'::interval)))))
  GROUP BY p.id, u.id, ps.id, sp.id;


--
-- Name: ai_knowledge_chunks trg_ai_chunk_denorm; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ai_chunk_denorm BEFORE INSERT OR UPDATE OF document_id ON public.ai_knowledge_chunks FOR EACH ROW EXECUTE FUNCTION public.ai_sync_chunk_denorm();


--
-- Name: ai_knowledge_documents trg_ai_doc_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ai_doc_status AFTER UPDATE ON public.ai_knowledge_documents FOR EACH ROW EXECUTE FUNCTION public.ai_propagate_doc_status();


--
-- Name: blog_posts trg_blog_posts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_blog_posts_updated BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: community_posts trg_community_posts_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_community_posts_updated BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pandits trg_enforce_seat_cap; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_seat_cap BEFORE INSERT OR UPDATE OF current_tier ON public.pandits FOR EACH ROW EXECUTE FUNCTION public.enforce_seat_cap();


--
-- Name: inquiries trg_inquiries_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inquiries_updated BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pandit_subscriptions trg_pandit_subs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pandit_subs_updated BEFORE UPDATE ON public.pandit_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pandits trg_pandits_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pandits_updated BEFORE UPDATE ON public.pandits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: payment_transactions trg_payments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: reviews trg_review_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_review_stats AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_pandit_review_stats();


--
-- Name: reviews trg_reviews_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: services trg_services_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: subscription_plans trg_subscription_plans_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_subscription_plans_updated BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pandit_temples trg_temple_pandit_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_temple_pandit_count AFTER INSERT OR DELETE OR UPDATE ON public.pandit_temples FOR EACH ROW EXECUTE FUNCTION public.update_temple_pandit_count();


--
-- Name: temples trg_temples_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_temples_updated BEFORE UPDATE ON public.temples FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: universal_faqs trg_universal_faqs_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_universal_faqs_updated BEFORE UPDATE ON public.universal_faqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: users trg_users_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: admin_activity_log admin_activity_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_activity_log
    ADD CONSTRAINT admin_activity_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id);


--
-- Name: admin_mfa_challenges admin_mfa_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_mfa_challenges
    ADD CONSTRAINT admin_mfa_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: admin_sessions admin_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_sessions
    ADD CONSTRAINT admin_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_conversations ai_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_feedback ai_feedback_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.ai_messages(id) ON DELETE CASCADE;


--
-- Name: ai_feedback ai_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feedback
    ADD CONSTRAINT ai_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_knowledge_chunks ai_knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_chunks
    ADD CONSTRAINT ai_knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.ai_knowledge_documents(id) ON DELETE CASCADE;


--
-- Name: ai_knowledge_documents ai_knowledge_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_documents
    ADD CONSTRAINT ai_knowledge_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_knowledge_documents ai_knowledge_documents_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_documents
    ADD CONSTRAINT ai_knowledge_documents_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: ai_knowledge_documents ai_knowledge_documents_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_knowledge_documents
    ADD CONSTRAINT ai_knowledge_documents_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE SET NULL;


--
-- Name: ai_messages ai_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;


--
-- Name: ai_problem_categories ai_problem_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_problem_categories
    ADD CONSTRAINT ai_problem_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ai_problem_categories(id) ON DELETE SET NULL;


--
-- Name: ai_problem_service_mappings ai_problem_service_mappings_problem_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_problem_service_mappings
    ADD CONSTRAINT ai_problem_service_mappings_problem_category_id_fkey FOREIGN KEY (problem_category_id) REFERENCES public.ai_problem_categories(id) ON DELETE CASCADE;


--
-- Name: ai_problem_service_mappings ai_problem_service_mappings_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_problem_service_mappings
    ADD CONSTRAINT ai_problem_service_mappings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: ai_problem_service_mappings ai_problem_service_mappings_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_problem_service_mappings
    ADD CONSTRAINT ai_problem_service_mappings_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE SET NULL;


--
-- Name: ai_query_analytics ai_query_analytics_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_query_analytics
    ADD CONSTRAINT ai_query_analytics_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE SET NULL;


--
-- Name: ai_ranking_config ai_ranking_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_ranking_config
    ADD CONSTRAINT ai_ranking_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_recommendation_events ai_recommendation_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendation_events
    ADD CONSTRAINT ai_recommendation_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.ai_conversations(id) ON DELETE CASCADE;


--
-- Name: ai_recommendation_events ai_recommendation_events_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendation_events
    ADD CONSTRAINT ai_recommendation_events_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.ai_messages(id) ON DELETE CASCADE;


--
-- Name: ai_recommendation_events ai_recommendation_events_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendation_events
    ADD CONSTRAINT ai_recommendation_events_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: ai_recommendation_events ai_recommendation_events_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendation_events
    ADD CONSTRAINT ai_recommendation_events_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: ai_recommendation_events ai_recommendation_events_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendation_events
    ADD CONSTRAINT ai_recommendation_events_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE CASCADE;


--
-- Name: ai_recommendation_events ai_recommendation_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendation_events
    ADD CONSTRAINT ai_recommendation_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_recommendations ai_recommendations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_recommendations
    ADD CONSTRAINT ai_recommendations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: banned_ips banned_ips_banned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banned_ips
    ADD CONSTRAINT banned_ips_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES public.users(id);


--
-- Name: banned_ips banned_ips_unbanned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banned_ips
    ADD CONSTRAINT banned_ips_unbanned_by_fkey FOREIGN KEY (unbanned_by) REFERENCES public.users(id);


--
-- Name: blog_posts blog_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: community_comments community_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_comments
    ADD CONSTRAINT community_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.community_comments(id);


--
-- Name: community_comments community_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_comments
    ADD CONSTRAINT community_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts(id) ON DELETE CASCADE;


--
-- Name: community_comments community_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_comments
    ADD CONSTRAINT community_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: community_posts community_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.community_posts
    ADD CONSTRAINT community_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: contact_clicks contact_clicks_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_clicks
    ADD CONSTRAINT contact_clicks_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id);


--
-- Name: contact_clicks contact_clicks_qualified_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_clicks
    ADD CONSTRAINT contact_clicks_qualified_lead_id_fkey FOREIGN KEY (qualified_lead_id) REFERENCES public.qualified_leads(id) ON DELETE SET NULL;


--
-- Name: contact_clicks contact_clicks_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_clicks
    ADD CONSTRAINT contact_clicks_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: contact_clicks contact_clicks_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_clicks
    ADD CONSTRAINT contact_clicks_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id);


--
-- Name: contact_clicks contact_clicks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_clicks
    ADD CONSTRAINT contact_clicks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: distribution_config_audit distribution_config_audit_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribution_config_audit
    ADD CONSTRAINT distribution_config_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: distribution_config distribution_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.distribution_config
    ADD CONSTRAINT distribution_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: home_hero_images home_hero_images_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_hero_images
    ADD CONSTRAINT home_hero_images_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: inquiries inquiries_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id);


--
-- Name: inquiries inquiries_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: inquiries inquiries_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id);


--
-- Name: inquiries inquiries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: otp_verifications otp_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pandit_analytics pandit_analytics_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_analytics
    ADD CONSTRAINT pandit_analytics_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_availability pandit_availability_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_availability
    ADD CONSTRAINT pandit_availability_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_blocked_dates pandit_blocked_dates_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_blocked_dates
    ADD CONSTRAINT pandit_blocked_dates_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_certificates pandit_certificates_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_certificates
    ADD CONSTRAINT pandit_certificates_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_certificates pandit_certificates_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_certificates
    ADD CONSTRAINT pandit_certificates_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: pandit_exposure pandit_exposure_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_exposure
    ADD CONSTRAINT pandit_exposure_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_exposure pandit_exposure_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_exposure
    ADD CONSTRAINT pandit_exposure_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: pandit_exposure pandit_exposure_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_exposure
    ADD CONSTRAINT pandit_exposure_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE SET NULL;


--
-- Name: pandit_exposure pandit_exposure_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_exposure
    ADD CONSTRAINT pandit_exposure_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: pandit_languages pandit_languages_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_languages
    ADD CONSTRAINT pandit_languages_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_media pandit_media_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_media
    ADD CONSTRAINT pandit_media_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_services pandit_services_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_services
    ADD CONSTRAINT pandit_services_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_services pandit_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_services
    ADD CONSTRAINT pandit_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: pandit_subscriptions pandit_subscriptions_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_subscriptions
    ADD CONSTRAINT pandit_subscriptions_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_subscriptions pandit_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_subscriptions
    ADD CONSTRAINT pandit_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: pandit_temples pandit_temples_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_temples
    ADD CONSTRAINT pandit_temples_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: pandit_temples pandit_temples_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandit_temples
    ADD CONSTRAINT pandit_temples_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE CASCADE;


--
-- Name: pandits pandits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandits
    ADD CONSTRAINT pandits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pandits pandits_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pandits
    ADD CONSTRAINT pandits_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: password_reset_challenges password_reset_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_challenges
    ADD CONSTRAINT password_reset_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id);


--
-- Name: payment_transactions payment_transactions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: payment_transactions payment_transactions_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.pandit_subscriptions(id);


--
-- Name: platform_settings platform_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: qualified_leads qualified_leads_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qualified_leads
    ADD CONSTRAINT qualified_leads_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: qualified_leads qualified_leads_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qualified_leads
    ADD CONSTRAINT qualified_leads_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: qualified_leads qualified_leads_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qualified_leads
    ADD CONSTRAINT qualified_leads_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE SET NULL;


--
-- Name: qualified_leads qualified_leads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qualified_leads
    ADD CONSTRAINT qualified_leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: review_helpfulness review_helpfulness_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpfulness
    ADD CONSTRAINT review_helpfulness_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: review_helpfulness review_helpfulness_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_helpfulness
    ADD CONSTRAINT review_helpfulness_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: saved_pandits saved_pandits_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_pandits
    ADD CONSTRAINT saved_pandits_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE CASCADE;


--
-- Name: saved_pandits saved_pandits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_pandits
    ADD CONSTRAINT saved_pandits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: saved_temples saved_temples_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_temples
    ADD CONSTRAINT saved_temples_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE CASCADE;


--
-- Name: saved_temples saved_temples_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_temples
    ADD CONSTRAINT saved_temples_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: security_audit_log security_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_audit_log
    ADD CONSTRAINT security_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: service_samagri service_samagri_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_samagri
    ADD CONSTRAINT service_samagri_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id);


--
-- Name: site_images site_images_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_images
    ADD CONSTRAINT site_images_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: subscription_reminder_log subscription_reminder_log_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_reminder_log
    ADD CONSTRAINT subscription_reminder_log_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.pandit_subscriptions(id) ON DELETE CASCADE;


--
-- Name: temple_media temple_media_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_media
    ADD CONSTRAINT temple_media_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE CASCADE;


--
-- Name: temple_media temple_media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_media
    ADD CONSTRAINT temple_media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: temple_services temple_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_services
    ADD CONSTRAINT temple_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: temple_services temple_services_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_services
    ADD CONSTRAINT temple_services_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE CASCADE;


--
-- Name: temple_timings temple_timings_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temple_timings
    ADD CONSTRAINT temple_timings_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE CASCADE;


--
-- Name: temples temples_managed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.temples
    ADD CONSTRAINT temples_managed_by_fkey FOREIGN KEY (managed_by) REFERENCES public.users(id);


--
-- Name: universal_faqs universal_faqs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universal_faqs
    ADD CONSTRAINT universal_faqs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: universal_faqs universal_faqs_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universal_faqs
    ADD CONSTRAINT universal_faqs_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: user_activity_events user_activity_events_pandit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_events
    ADD CONSTRAINT user_activity_events_pandit_id_fkey FOREIGN KEY (pandit_id) REFERENCES public.pandits(id) ON DELETE SET NULL;


--
-- Name: user_activity_events user_activity_events_qualified_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_events
    ADD CONSTRAINT user_activity_events_qualified_lead_id_fkey FOREIGN KEY (qualified_lead_id) REFERENCES public.qualified_leads(id) ON DELETE SET NULL;


--
-- Name: user_activity_events user_activity_events_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_events
    ADD CONSTRAINT user_activity_events_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: user_activity_events user_activity_events_temple_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_events
    ADD CONSTRAINT user_activity_events_temple_id_fkey FOREIGN KEY (temple_id) REFERENCES public.temples(id) ON DELETE SET NULL;


--
-- Name: user_activity_events user_activity_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_events
    ADD CONSTRAINT user_activity_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: visitor_geo_log visitor_geo_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitor_geo_log
    ADD CONSTRAINT visitor_geo_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_conversations ai_conv_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_conv_admin ON public.ai_conversations FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: ai_conversations ai_conv_guest_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_conv_guest_insert ON public.ai_conversations FOR INSERT WITH CHECK (((user_id IS NULL) AND (session_key IS NOT NULL) AND ((session_key)::text = public.current_app_session_key())));


--
-- Name: ai_conversations ai_conv_guest_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_conv_guest_select ON public.ai_conversations FOR SELECT USING (((user_id IS NULL) AND ((session_key)::text = public.current_app_session_key())));


--
-- Name: ai_conversations ai_conv_guest_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_conv_guest_update ON public.ai_conversations FOR UPDATE USING (((user_id IS NULL) AND ((session_key)::text = public.current_app_session_key())));


--
-- Name: ai_conversations ai_conv_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_conv_own ON public.ai_conversations USING (((user_id IS NOT NULL) AND (user_id = public.current_app_user_id())));


--
-- Name: ai_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_recommendation_events ai_events_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_events_admin ON public.ai_recommendation_events FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: ai_recommendation_events ai_events_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_events_insert ON public.ai_recommendation_events FOR INSERT WITH CHECK (true);


--
-- Name: ai_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_feedback ai_feedback_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_feedback_admin ON public.ai_feedback FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: ai_feedback ai_feedback_guest; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_feedback_guest ON public.ai_feedback FOR INSERT WITH CHECK (((user_id IS NULL) AND (message_id IN ( SELECT m.id
   FROM (public.ai_messages m
     JOIN public.ai_conversations c ON ((c.id = m.conversation_id)))
  WHERE ((c.user_id IS NULL) AND ((c.session_key)::text = public.current_app_session_key()))))));


--
-- Name: ai_feedback ai_feedback_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_feedback_own ON public.ai_feedback USING (((user_id IS NOT NULL) AND (user_id = public.current_app_user_id())));


--
-- Name: ai_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_messages ai_msg_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_msg_admin ON public.ai_messages FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: ai_messages ai_msg_guest_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_msg_guest_insert ON public.ai_messages FOR INSERT WITH CHECK ((conversation_id IN ( SELECT ai_conversations.id
   FROM public.ai_conversations
  WHERE ((ai_conversations.user_id IS NULL) AND ((ai_conversations.session_key)::text = public.current_app_session_key())))));


--
-- Name: ai_messages ai_msg_guest_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_msg_guest_select ON public.ai_messages FOR SELECT USING ((conversation_id IN ( SELECT ai_conversations.id
   FROM public.ai_conversations
  WHERE ((ai_conversations.user_id IS NULL) AND ((ai_conversations.session_key)::text = public.current_app_session_key())))));


--
-- Name: ai_messages ai_msg_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_msg_own ON public.ai_messages USING ((conversation_id IN ( SELECT ai_conversations.id
   FROM public.ai_conversations
  WHERE ((ai_conversations.user_id IS NOT NULL) AND (ai_conversations.user_id = public.current_app_user_id())))));


--
-- Name: ai_query_analytics ai_qa_insert_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_qa_insert_system ON public.ai_query_analytics FOR INSERT WITH CHECK (true);


--
-- Name: ai_query_analytics ai_qa_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_qa_select_admin ON public.ai_query_analytics FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: ai_query_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_query_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_recommendation_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_recommendation_events ENABLE ROW LEVEL SECURITY;

--
-- Name: pandit_analytics analytics_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_select_admin ON public.pandit_analytics FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: pandit_analytics analytics_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_select_own ON public.pandit_analytics FOR SELECT USING ((pandit_id IN ( SELECT pandits.id
   FROM public.pandits
  WHERE (pandits.user_id = public.current_app_user_id()))));


--
-- Name: pandit_analytics analytics_update_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_update_system ON public.pandit_analytics FOR UPDATE USING (true);


--
-- Name: pandit_analytics analytics_write_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY analytics_write_system ON public.pandit_analytics FOR INSERT WITH CHECK (true);


--
-- Name: home_hero_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.home_hero_images ENABLE ROW LEVEL SECURITY;

--
-- Name: home_hero_images home_hero_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_hero_select_public ON public.home_hero_images FOR SELECT USING (true);


--
-- Name: home_hero_images home_hero_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY home_hero_write_admin ON public.home_hero_images USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin());


--
-- Name: inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: inquiries inquiries_insert_any; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inquiries_insert_any ON public.inquiries FOR INSERT WITH CHECK (true);


--
-- Name: inquiries inquiries_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inquiries_select_admin ON public.inquiries FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: inquiries inquiries_select_own_or_pandit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inquiries_select_own_or_pandit ON public.inquiries FOR SELECT USING (((user_id = public.current_app_user_id()) OR (pandit_id IN ( SELECT pandits.id
   FROM public.pandits
  WHERE (pandits.user_id = public.current_app_user_id())))));


--
-- Name: inquiries inquiries_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inquiries_update_admin ON public.inquiries FOR UPDATE USING (public.current_app_user_is_admin());


--
-- Name: inquiries inquiries_update_pandit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inquiries_update_pandit ON public.inquiries FOR UPDATE USING ((pandit_id IN ( SELECT pandits.id
   FROM public.pandits
  WHERE (pandits.user_id = public.current_app_user_id()))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_insert_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_insert_system ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: notifications notifications_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_admin ON public.notifications FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT USING ((user_id = public.current_app_user_id()));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE USING ((user_id = public.current_app_user_id()));


--
-- Name: pandit_analytics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pandit_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: pandits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pandits ENABLE ROW LEVEL SECURITY;

--
-- Name: pandits pandits_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pandits_insert_self ON public.pandits FOR INSERT WITH CHECK ((user_id = public.current_app_user_id()));


--
-- Name: pandits pandits_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pandits_select_public ON public.pandits FOR SELECT USING (true);


--
-- Name: pandits pandits_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pandits_update_admin ON public.pandits FOR UPDATE USING (public.current_app_user_is_admin());


--
-- Name: pandits pandits_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pandits_update_self ON public.pandits FOR UPDATE USING ((user_id = public.current_app_user_id()));


--
-- Name: password_reset_challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions payments_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_select_admin ON public.payment_transactions FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: payment_transactions payments_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_select_own ON public.payment_transactions FOR SELECT USING ((pandit_id IN ( SELECT pandits.id
   FROM public.pandits
  WHERE (pandits.user_id = public.current_app_user_id()))));


--
-- Name: payment_transactions payments_select_verified_webhook; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_select_verified_webhook ON public.payment_transactions FOR SELECT USING ((current_setting('app.webhook_verified'::text, true) = 'true'::text));


--
-- Name: payment_transactions payments_update_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_update_system ON public.payment_transactions FOR UPDATE USING (true);


--
-- Name: payment_transactions payments_write_system; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_write_system ON public.payment_transactions FOR INSERT WITH CHECK (true);


--
-- Name: qualified_leads qleads_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qleads_select_admin ON public.qualified_leads FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: qualified_leads qleads_select_own_pandit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qleads_select_own_pandit ON public.qualified_leads FOR SELECT USING ((pandit_id IN ( SELECT pandits.id
   FROM public.pandits
  WHERE (pandits.user_id = public.current_app_user_id()))));


--
-- Name: qualified_leads qleads_update_own_pandit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY qleads_update_own_pandit ON public.qualified_leads FOR UPDATE USING ((pandit_id IN ( SELECT pandits.id
   FROM public.pandits
  WHERE (pandits.user_id = public.current_app_user_id()))));


--
-- Name: qualified_leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qualified_leads ENABLE ROW LEVEL SECURITY;

--
-- Name: password_reset_challenges reset_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reset_admin_select ON public.password_reset_challenges FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: site_images; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;

--
-- Name: site_images site_images_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_images_select_public ON public.site_images FOR SELECT USING (true);


--
-- Name: site_images site_images_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_images_write_admin ON public.site_images USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin());


--
-- Name: universal_faqs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.universal_faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: universal_faqs universal_faqs_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY universal_faqs_select_admin ON public.universal_faqs FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: universal_faqs universal_faqs_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY universal_faqs_select_public ON public.universal_faqs FOR SELECT USING ((status = 'published'::public.content_status));


--
-- Name: universal_faqs universal_faqs_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY universal_faqs_write_admin ON public.universal_faqs USING (public.current_app_user_is_admin()) WITH CHECK (public.current_app_user_is_admin());


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_self ON public.users FOR INSERT WITH CHECK (true);


--
-- Name: users users_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_admin ON public.users FOR SELECT USING (public.current_app_user_is_admin());


--
-- Name: users users_select_by_admin_bearer_session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_by_admin_bearer_session ON public.users FOR SELECT USING ((id IN ( SELECT admin_sessions.user_id
   FROM public.admin_sessions
  WHERE (((admin_sessions.token_hash)::text = NULLIF(current_setting('app.admin_session_token_hash'::text, true), ''::text)) AND (admin_sessions.revoked_at IS NULL) AND (admin_sessions.expires_at > now())))));


--
-- Name: users users_select_by_bearer_session; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_by_bearer_session ON public.users FOR SELECT USING ((id IN ( SELECT user_sessions.user_id
   FROM public.user_sessions
  WHERE (((user_sessions.token_hash)::text = NULLIF(current_setting('app.session_token_hash'::text, true), ''::text)) AND (user_sessions.revoked_at IS NULL) AND (user_sessions.expires_at > now())))));


--
-- Name: users users_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_public ON public.users FOR SELECT USING ((role = ANY (ARRAY['pandit'::public.user_role, 'temple_admin'::public.user_role])));


--
-- Name: users users_select_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_self ON public.users FOR SELECT USING ((id = public.current_app_user_id()));


--
-- Name: users users_select_via_public_content; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_via_public_content ON public.users FOR SELECT USING (((id IN ( SELECT reviews.user_id
   FROM public.reviews
  WHERE ((reviews.is_approved = true) AND (reviews.deleted_at IS NULL)))) OR (id IN ( SELECT community_posts.user_id
   FROM public.community_posts
  WHERE (community_posts.status = 'published'::public.content_status))) OR (id IN ( SELECT community_comments.user_id
   FROM public.community_comments
  WHERE (community_comments.status = 'published'::public.content_status))) OR (id IN ( SELECT blog_posts.author_id
   FROM public.blog_posts
  WHERE (blog_posts.status = 'published'::public.content_status)))));


--
-- Name: users users_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_admin ON public.users FOR UPDATE USING (public.current_app_user_is_admin());


--
-- Name: users users_update_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_self ON public.users FOR UPDATE USING ((id = public.current_app_user_id()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO panditsuggest_app;
GRANT USAGE ON SCHEMA public TO panditsuggest_readonly;


--
-- Name: FUNCTION activate_pandit_subscription(p_pandit_id uuid, p_tier public.subscription_tier, p_expires_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.activate_pandit_subscription(p_pandit_id uuid, p_tier public.subscription_tier, p_expires_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.activate_pandit_subscription(p_pandit_id uuid, p_tier public.subscription_tier, p_expires_at timestamp with time zone) TO panditsuggest_app;


--
-- Name: FUNCTION admin_find_challenge_with_user(p_token_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_find_challenge_with_user(p_token_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_find_challenge_with_user(p_token_hash text) TO panditsuggest_app;


--
-- Name: FUNCTION auth_consume_reset_challenge(p_token_hash text, p_new_password_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auth_consume_reset_challenge(p_token_hash text, p_new_password_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.auth_consume_reset_challenge(p_token_hash text, p_new_password_hash text) TO panditsuggest_app;


--
-- Name: FUNCTION auth_create_reset_challenge(p_user_id uuid, p_token_hash text, p_ttl_minutes integer, p_ip text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auth_create_reset_challenge(p_user_id uuid, p_token_hash text, p_ttl_minutes integer, p_ip text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.auth_create_reset_challenge(p_user_id uuid, p_token_hash text, p_ttl_minutes integer, p_ip text) TO panditsuggest_app;


--
-- Name: FUNCTION auth_find_pandit_for_reset(p_email text, p_dob date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auth_find_pandit_for_reset(p_email text, p_dob date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.auth_find_pandit_for_reset(p_email text, p_dob date) TO panditsuggest_app;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,DELETE,UPDATE ON TABLE public.users TO panditsuggest_app;


--
-- Name: COLUMN users.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(id) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.email; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(email) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(email) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.phone; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(phone) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(phone) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.full_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(full_name) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(full_name) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.display_name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(display_name) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(display_name) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(avatar_url) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(avatar_url) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.role; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(role) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(role) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(status) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(status) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.city; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(city) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(city) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.state; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(state) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(state) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.pincode; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pincode) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(pincode) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.latitude; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(latitude) ON TABLE public.users TO panditsuggest_app;


--
-- Name: COLUMN users.longitude; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(longitude) ON TABLE public.users TO panditsuggest_app;


--
-- Name: COLUMN users.preferred_language; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(preferred_language) ON TABLE public.users TO panditsuggest_app;


--
-- Name: COLUMN users.theme_preference; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(theme_preference) ON TABLE public.users TO panditsuggest_app;


--
-- Name: COLUMN users.email_verified; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(email_verified) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(email_verified) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.phone_verified; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(phone_verified) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(phone_verified) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.last_login_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(last_login_at) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(last_login_at) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.login_count; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(login_count) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(login_count) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.totp_enabled; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(totp_enabled) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(totp_enabled) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(created_at) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(updated_at) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.deleted_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(deleted_at) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(deleted_at) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: COLUMN users.country; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(country) ON TABLE public.users TO panditsuggest_app;
GRANT SELECT(country) ON TABLE public.users TO panditsuggest_readonly;


--
-- Name: FUNCTION auth_find_user_by_email(p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auth_find_user_by_email(p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.auth_find_user_by_email(p_email text) TO panditsuggest_app;


--
-- Name: FUNCTION auth_find_user_by_phone(p_phone text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auth_find_user_by_phone(p_phone text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.auth_find_user_by_phone(p_phone text) TO panditsuggest_app;


--
-- Name: FUNCTION calculate_pandit_rank(p_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calculate_pandit_rank(p_id uuid) TO panditsuggest_app;


--
-- Name: FUNCTION current_app_session_key(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_app_session_key() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_app_session_key() TO panditsuggest_app;


--
-- Name: FUNCTION current_app_user_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_app_user_id() TO panditsuggest_app;


--
-- Name: FUNCTION current_app_user_is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_app_user_is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_app_user_is_admin() TO panditsuggest_app;


--
-- Name: FUNCTION get_pandit_lead_counts(p_since timestamp with time zone, p_today_start timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_pandit_lead_counts(p_since timestamp with time zone, p_today_start timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_pandit_lead_counts(p_since timestamp with time zone, p_today_start timestamp with time zone) TO panditsuggest_app;


--
-- Name: FUNCTION increment_pandit_stats(p_id uuid, p_type character varying, p_method character varying); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.increment_pandit_stats(p_id uuid, p_type character varying, p_method character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION public.increment_pandit_stats(p_id uuid, p_type character varying, p_method character varying) TO panditsuggest_app;


--
-- Name: FUNCTION record_qualified_lead(p_pandit_id uuid, p_user_id uuid, p_method public.contact_method, p_dedup_hours integer, p_source character varying, p_temple_id uuid, p_service_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_qualified_lead(p_pandit_id uuid, p_user_id uuid, p_method public.contact_method, p_dedup_hours integer, p_source character varying, p_temple_id uuid, p_service_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_qualified_lead(p_pandit_id uuid, p_user_id uuid, p_method public.contact_method, p_dedup_hours integer, p_source character varying, p_temple_id uuid, p_service_id uuid) TO panditsuggest_app;


--
-- Name: FUNCTION revert_expired_pandit_tiers(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.revert_expired_pandit_tiers() FROM PUBLIC;
GRANT ALL ON FUNCTION public.revert_expired_pandit_tiers() TO panditsuggest_app;


--
-- Name: FUNCTION seat_usage(p_tier public.subscription_tier); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.seat_usage(p_tier public.subscription_tier) TO panditsuggest_app;


--
-- Name: FUNCTION set_distribution_config(p_key character varying, p_value numeric, p_admin_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_distribution_config(p_key character varying, p_value numeric, p_admin_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_distribution_config(p_key character varying, p_value numeric, p_admin_id uuid) TO panditsuggest_app;


--
-- Name: FUNCTION set_plan_entitlement(p_tier public.subscription_tier, p_market public.lead_market, p_weight numeric, p_daily_cap integer, p_priority integer, p_seat_cap integer, p_price integer, p_active boolean, p_admin_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_plan_entitlement(p_tier public.subscription_tier, p_market public.lead_market, p_weight numeric, p_daily_cap integer, p_priority integer, p_seat_cap integer, p_price integer, p_active boolean, p_admin_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_plan_entitlement(p_tier public.subscription_tier, p_market public.lead_market, p_weight numeric, p_daily_cap integer, p_priority integer, p_seat_cap integer, p_price integer, p_active boolean, p_admin_id uuid) TO panditsuggest_app;


--
-- Name: FUNCTION update_pandit_review_stats(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_pandit_review_stats() TO panditsuggest_app;


--
-- Name: FUNCTION update_temple_pandit_count(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_temple_pandit_count() TO panditsuggest_app;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at() TO panditsuggest_app;


--
-- Name: TABLE admin_activity_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.admin_activity_log TO panditsuggest_app;
GRANT SELECT ON TABLE public.admin_activity_log TO panditsuggest_readonly;


--
-- Name: SEQUENCE admin_activity_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.admin_activity_log_id_seq TO panditsuggest_app;


--
-- Name: TABLE admin_mfa_challenges; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_mfa_challenges TO panditsuggest_app;
GRANT SELECT ON TABLE public.admin_mfa_challenges TO panditsuggest_readonly;


--
-- Name: TABLE admin_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.admin_sessions TO panditsuggest_app;
GRANT SELECT ON TABLE public.admin_sessions TO panditsuggest_readonly;


--
-- Name: TABLE ai_conversations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_conversations TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_conversations TO panditsuggest_readonly;


--
-- Name: TABLE ai_feedback; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_feedback TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_feedback TO panditsuggest_readonly;


--
-- Name: TABLE ai_knowledge_chunks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_knowledge_chunks TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_knowledge_chunks TO panditsuggest_readonly;


--
-- Name: TABLE ai_knowledge_documents; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_knowledge_documents TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_knowledge_documents TO panditsuggest_readonly;


--
-- Name: TABLE ai_messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_messages TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_messages TO panditsuggest_readonly;


--
-- Name: TABLE ai_problem_categories; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_problem_categories TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_problem_categories TO panditsuggest_readonly;


--
-- Name: TABLE ai_problem_service_mappings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_problem_service_mappings TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_problem_service_mappings TO panditsuggest_readonly;


--
-- Name: TABLE ai_query_analytics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.ai_query_analytics TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_query_analytics TO panditsuggest_readonly;


--
-- Name: TABLE ai_ranking_config; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_ranking_config TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_ranking_config TO panditsuggest_readonly;


--
-- Name: TABLE ai_recommendation_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_recommendation_events TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_recommendation_events TO panditsuggest_readonly;


--
-- Name: TABLE ai_recommendations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_recommendations TO panditsuggest_app;
GRANT SELECT ON TABLE public.ai_recommendations TO panditsuggest_readonly;


--
-- Name: TABLE banned_ips; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.banned_ips TO panditsuggest_app;
GRANT SELECT ON TABLE public.banned_ips TO panditsuggest_readonly;


--
-- Name: TABLE blog_posts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.blog_posts TO panditsuggest_app;
GRANT SELECT ON TABLE public.blog_posts TO panditsuggest_readonly;


--
-- Name: TABLE community_comments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_comments TO panditsuggest_app;
GRANT SELECT ON TABLE public.community_comments TO panditsuggest_readonly;


--
-- Name: TABLE community_posts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.community_posts TO panditsuggest_app;
GRANT SELECT ON TABLE public.community_posts TO panditsuggest_readonly;


--
-- Name: TABLE contact_clicks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.contact_clicks TO panditsuggest_app;
GRANT SELECT ON TABLE public.contact_clicks TO panditsuggest_readonly;


--
-- Name: TABLE contact_messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.contact_messages TO panditsuggest_app;
GRANT SELECT ON TABLE public.contact_messages TO panditsuggest_readonly;


--
-- Name: TABLE deployment_environment; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.deployment_environment TO panditsuggest_app;
GRANT SELECT ON TABLE public.deployment_environment TO panditsuggest_readonly;


--
-- Name: TABLE distribution_config; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.distribution_config TO panditsuggest_app;
GRANT SELECT ON TABLE public.distribution_config TO panditsuggest_readonly;


--
-- Name: TABLE distribution_config_audit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.distribution_config_audit TO panditsuggest_app;
GRANT SELECT ON TABLE public.distribution_config_audit TO panditsuggest_readonly;


--
-- Name: TABLE home_hero_images; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.home_hero_images TO panditsuggest_app;
GRANT SELECT ON TABLE public.home_hero_images TO panditsuggest_readonly;


--
-- Name: TABLE honeypot_logs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.honeypot_logs TO panditsuggest_app;
GRANT SELECT ON TABLE public.honeypot_logs TO panditsuggest_readonly;


--
-- Name: SEQUENCE honeypot_logs_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.honeypot_logs_id_seq TO panditsuggest_app;


--
-- Name: TABLE inquiries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inquiries TO panditsuggest_app;
GRANT SELECT ON TABLE public.inquiries TO panditsuggest_readonly;


--
-- Name: TABLE newsletter_subscribers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.newsletter_subscribers TO panditsuggest_app;
GRANT SELECT ON TABLE public.newsletter_subscribers TO panditsuggest_readonly;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.notifications TO panditsuggest_app;
GRANT SELECT ON TABLE public.notifications TO panditsuggest_readonly;


--
-- Name: TABLE otp_verifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.otp_verifications TO panditsuggest_app;
GRANT SELECT ON TABLE public.otp_verifications TO panditsuggest_readonly;


--
-- Name: TABLE pandit_analytics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_analytics TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_analytics TO panditsuggest_readonly;


--
-- Name: TABLE pandit_availability; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_availability TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_availability TO panditsuggest_readonly;


--
-- Name: TABLE pandit_blocked_dates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_blocked_dates TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_blocked_dates TO panditsuggest_readonly;


--
-- Name: TABLE pandit_certificates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_certificates TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_certificates TO panditsuggest_readonly;


--
-- Name: TABLE pandit_exposure; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.pandit_exposure TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_exposure TO panditsuggest_readonly;


--
-- Name: TABLE pandit_languages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_languages TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_languages TO panditsuggest_readonly;


--
-- Name: TABLE pandit_media; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_media TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_media TO panditsuggest_readonly;


--
-- Name: TABLE pandit_services; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_services TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_services TO panditsuggest_readonly;


--
-- Name: TABLE pandit_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_subscriptions TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_subscriptions TO panditsuggest_readonly;


--
-- Name: TABLE pandit_temples; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandit_temples TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandit_temples TO panditsuggest_readonly;


--
-- Name: TABLE pandits; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pandits TO panditsuggest_app;
GRANT SELECT ON TABLE public.pandits TO panditsuggest_readonly;


--
-- Name: TABLE password_reset_challenges; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.password_reset_challenges TO panditsuggest_app;
GRANT SELECT ON TABLE public.password_reset_challenges TO panditsuggest_readonly;


--
-- Name: TABLE payment_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_transactions TO panditsuggest_app;
GRANT SELECT ON TABLE public.payment_transactions TO panditsuggest_readonly;


--
-- Name: TABLE plan_market_entitlements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.plan_market_entitlements TO panditsuggest_app;
GRANT SELECT ON TABLE public.plan_market_entitlements TO panditsuggest_readonly;


--
-- Name: TABLE platform_analytics; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.platform_analytics TO panditsuggest_app;
GRANT SELECT ON TABLE public.platform_analytics TO panditsuggest_readonly;


--
-- Name: TABLE platform_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.platform_settings TO panditsuggest_app;
GRANT SELECT ON TABLE public.platform_settings TO panditsuggest_readonly;


--
-- Name: TABLE qualified_leads; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.qualified_leads TO panditsuggest_app;
GRANT SELECT ON TABLE public.qualified_leads TO panditsuggest_readonly;


--
-- Name: TABLE recommend_rules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.recommend_rules TO panditsuggest_app;
GRANT SELECT ON TABLE public.recommend_rules TO panditsuggest_readonly;


--
-- Name: TABLE review_helpfulness; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.review_helpfulness TO panditsuggest_app;
GRANT SELECT ON TABLE public.review_helpfulness TO panditsuggest_readonly;


--
-- Name: TABLE reviews; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.reviews TO panditsuggest_app;
GRANT SELECT ON TABLE public.reviews TO panditsuggest_readonly;


--
-- Name: TABLE saved_pandits; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.saved_pandits TO panditsuggest_app;
GRANT SELECT ON TABLE public.saved_pandits TO panditsuggest_readonly;


--
-- Name: TABLE saved_temples; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.saved_temples TO panditsuggest_app;
GRANT SELECT ON TABLE public.saved_temples TO panditsuggest_readonly;


--
-- Name: TABLE security_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.security_audit_log TO panditsuggest_app;
GRANT SELECT ON TABLE public.security_audit_log TO panditsuggest_readonly;


--
-- Name: SEQUENCE security_audit_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,USAGE ON SEQUENCE public.security_audit_log_id_seq TO panditsuggest_app;


--
-- Name: TABLE service_categories; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.service_categories TO panditsuggest_app;
GRANT SELECT ON TABLE public.service_categories TO panditsuggest_readonly;


--
-- Name: TABLE service_samagri; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.service_samagri TO panditsuggest_app;
GRANT SELECT ON TABLE public.service_samagri TO panditsuggest_readonly;


--
-- Name: TABLE services; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.services TO panditsuggest_app;
GRANT SELECT ON TABLE public.services TO panditsuggest_readonly;


--
-- Name: TABLE site_images; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.site_images TO panditsuggest_app;
GRANT SELECT ON TABLE public.site_images TO panditsuggest_readonly;


--
-- Name: TABLE stats; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stats TO panditsuggest_app;
GRANT SELECT ON TABLE public.stats TO panditsuggest_readonly;


--
-- Name: TABLE subscription_plans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.subscription_plans TO panditsuggest_app;
GRANT SELECT ON TABLE public.subscription_plans TO panditsuggest_readonly;


--
-- Name: TABLE subscription_reminder_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.subscription_reminder_log TO panditsuggest_app;
GRANT SELECT ON TABLE public.subscription_reminder_log TO panditsuggest_readonly;


--
-- Name: TABLE taxonomy; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.taxonomy TO panditsuggest_app;
GRANT SELECT ON TABLE public.taxonomy TO panditsuggest_readonly;


--
-- Name: TABLE temple_media; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.temple_media TO panditsuggest_app;
GRANT SELECT ON TABLE public.temple_media TO panditsuggest_readonly;


--
-- Name: TABLE temple_services; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.temple_services TO panditsuggest_app;
GRANT SELECT ON TABLE public.temple_services TO panditsuggest_readonly;


--
-- Name: TABLE temple_timings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.temple_timings TO panditsuggest_app;
GRANT SELECT ON TABLE public.temple_timings TO panditsuggest_readonly;


--
-- Name: TABLE temples; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.temples TO panditsuggest_app;
GRANT SELECT ON TABLE public.temples TO panditsuggest_readonly;


--
-- Name: TABLE universal_faqs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.universal_faqs TO panditsuggest_app;
GRANT SELECT ON TABLE public.universal_faqs TO panditsuggest_readonly;


--
-- Name: TABLE user_activity_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.user_activity_events TO panditsuggest_app;
GRANT SELECT ON TABLE public.user_activity_events TO panditsuggest_readonly;


--
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_sessions TO panditsuggest_app;
GRANT SELECT ON TABLE public.user_sessions TO panditsuggest_readonly;


--
-- Name: TABLE v_pandit_dashboard; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_pandit_dashboard TO panditsuggest_app;
GRANT SELECT ON TABLE public.v_pandit_dashboard TO panditsuggest_readonly;


--
-- Name: TABLE v_pandit_search; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_pandit_search TO panditsuggest_app;
GRANT SELECT ON TABLE public.v_pandit_search TO panditsuggest_readonly;


--
-- Name: TABLE v_temple_search; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_temple_search TO panditsuggest_app;
GRANT SELECT ON TABLE public.v_temple_search TO panditsuggest_readonly;


--
-- Name: TABLE visitor_geo_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.visitor_geo_log TO panditsuggest_app;
GRANT SELECT ON TABLE public.visitor_geo_log TO panditsuggest_readonly;


--
-- Name: TABLE webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.webhook_events TO panditsuggest_app;
GRANT SELECT ON TABLE public.webhook_events TO panditsuggest_readonly;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE panditsuggest_owner IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO panditsuggest_app;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE panditsuggest_owner IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO panditsuggest_app;
ALTER DEFAULT PRIVILEGES FOR ROLE panditsuggest_owner IN SCHEMA public GRANT SELECT ON TABLES TO panditsuggest_readonly;


--
-- PostgreSQL database dump complete
--

