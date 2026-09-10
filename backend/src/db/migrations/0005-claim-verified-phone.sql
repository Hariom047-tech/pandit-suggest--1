-- ============================================================================
-- 0005 — let a devotee claim a phone their other, phone-only account holds
-- ============================================================================
-- One human ends up with two accounts all the time: they sign in on the phone
-- with an OTP (which creates an account whose ONLY identity is that number —
-- no email, no password, no google_id; see auth.controller.js phoneLogin), and
-- later sign in on the desktop with Google (which creates a second account
-- whose only identity is the Google address).
--
-- record_qualified_lead() gates every lead on phone_verified, so the Google
-- account cannot contact a pandit until it verifies a number. When they enter
-- the number they already used on the phone, users.phone being UNIQUE means
-- the write fails — and the honest answer to "this number is on another
-- account" is not to refuse, because of what that other account is:
--
--   its only login method IS the phone number, so the only person who could
--   ever get into it is whoever controls that number — which is exactly the
--   person who just passed the OTP. There is no second party to protect here.
--
-- So the number moves, and the old account's contents move with it rather than
-- being stranded behind a login nobody can reach any more.
--
-- WHAT AUTHORISES THIS: the caller having just matched an OTP for p_phone.
-- The database cannot see that, so this is SECURITY DEFINER (the same trust
-- shape as auth_find_user_by_email) and EXECUTE is granted only to the app
-- role. auth.controller.js's verifyOtp is the sole caller, and it calls this
-- only after otpMatches() has passed. Every other precondition is enforced
-- below, inside the function, precisely because SECURITY DEFINER means RLS is
-- not going to enforce anything for us.
--
-- Returns one of: 'set' (nobody held it), 'already_own' (the caller already
-- did), 'merged' (absorbed the other account). Raises with SQLSTATE 'PS001'
-- when the holder is a real, separately-reachable account — the caller turns
-- that into a 409 rather than a 500.
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_verified_phone(p_phone TEXT, p_into UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_holder  users%ROWTYPE;
  v_target  users%ROWTYPE;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' OR p_into IS NULL THEN
    RAISE EXCEPTION 'claim_verified_phone requires a phone and a user' USING ERRCODE = 'PS001';
  END IF;

  SELECT * INTO v_target FROM users WHERE id = p_into AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target account not found' USING ERRCODE = 'PS001';
  END IF;

  SELECT * INTO v_holder FROM users WHERE phone = p_phone AND deleted_at IS NULL;

  -- Nobody holds it, or the caller already does. Just record it.
  IF NOT FOUND OR v_holder.id = p_into THEN
    UPDATE users
       SET phone = p_phone, phone_verified = TRUE,
           status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END
     WHERE id = p_into;
    RETURN CASE WHEN FOUND AND v_holder.id = p_into THEN 'already_own' ELSE 'set' END;
  END IF;

  -- Someone else holds it. Absorb them ONLY if the phone is genuinely their
  -- sole way in. A holder with a password, a linked Google account or a
  -- verified email is a separate person's account as far as this code is
  -- concerned, and keeps the number.
  IF v_holder.role <> 'devotee'
     OR v_holder.password_hash IS NOT NULL
     OR v_holder.google_id IS NOT NULL
     OR COALESCE(v_holder.email_verified, FALSE)
     OR NOT COALESCE(v_holder.phone_verified, FALSE) THEN
    RAISE EXCEPTION 'Phone belongs to a separately reachable account'
      USING ERRCODE = 'PS001';
  END IF;

  -- Never merge into anything but a devotee's own account either.
  IF v_target.role <> 'devotee' THEN
    RAISE EXCEPTION 'Only a devotee account can absorb another' USING ERRCODE = 'PS001';
  END IF;

  -- ---- collision-prone moves ------------------------------------------
  -- Each of these has a UNIQUE key containing user_id, so a row that would
  -- land on top of one the target already has is dropped rather than moved:
  -- the target's own row is the one they can currently see, and keeping it is
  -- what makes this idempotent if the merge is ever retried.
  DELETE FROM saved_pandits s
   WHERE s.user_id = v_holder.id
     AND EXISTS (SELECT 1 FROM saved_pandits t
                  WHERE t.user_id = p_into AND t.pandit_id = s.pandit_id);
  UPDATE saved_pandits SET user_id = p_into WHERE user_id = v_holder.id;

  DELETE FROM saved_temples s
   WHERE s.user_id = v_holder.id
     AND EXISTS (SELECT 1 FROM saved_temples t
                  WHERE t.user_id = p_into AND t.temple_id = s.temple_id);
  UPDATE saved_temples SET user_id = p_into WHERE user_id = v_holder.id;

  DELETE FROM review_helpfulness s
   WHERE s.user_id = v_holder.id
     AND EXISTS (SELECT 1 FROM review_helpfulness t
                  WHERE t.user_id = p_into AND t.review_id = s.review_id);
  UPDATE review_helpfulness SET user_id = p_into WHERE user_id = v_holder.id;

  DELETE FROM ai_feedback s
   WHERE s.user_id = v_holder.id
     AND EXISTS (SELECT 1 FROM ai_feedback t
                  WHERE t.user_id = p_into AND t.message_id = s.message_id);
  UPDATE ai_feedback SET user_id = p_into WHERE user_id = v_holder.id;

  -- reviews carries two partial unique indexes: one review per target per
  -- user, and one platform review per user. Same rule — the target's own
  -- review wins and the duplicate is soft-deleted rather than hard-deleted,
  -- because a review is content the devotee wrote.
  UPDATE reviews s SET deleted_at = NOW()
   WHERE s.user_id = v_holder.id AND s.deleted_at IS NULL
     AND EXISTS (
       SELECT 1 FROM reviews t
        WHERE t.user_id = p_into AND t.deleted_at IS NULL
          AND t.reviewable_type IS NOT DISTINCT FROM s.reviewable_type
          AND t.reviewable_id   IS NOT DISTINCT FROM s.reviewable_id);
  UPDATE reviews SET user_id = p_into WHERE user_id = v_holder.id;

  -- ---- plain moves ------------------------------------------------------
  UPDATE inquiries               SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE community_posts         SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE community_comments      SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE notifications           SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE contact_clicks          SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE qualified_leads         SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE pandit_exposure         SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE ai_conversations        SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE ai_recommendations      SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE ai_recommendation_events SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE user_activity_events    SET user_id = p_into WHERE user_id = v_holder.id;
  UPDATE visitor_geo_log         SET user_id = p_into WHERE user_id = v_holder.id;

  -- Deliberately NOT moved: user_sessions, otp_verifications and
  -- security_audit_log. Those record what happened on THAT account — an audit
  -- trail that is rewritten is not an audit trail — and the sessions are
  -- revoked below instead, so the absorbed login cannot keep being used.
  UPDATE user_sessions SET revoked_at = NOW()
   WHERE user_id = v_holder.id AND revoked_at IS NULL;

  -- Free the number first: users.phone is UNIQUE, so the target cannot take it
  -- while the holder still has it, and both statements are in the caller's
  -- transaction so no other session sees the gap.
  UPDATE users
     SET phone = NULL, phone_verified = FALSE,
         deleted_at = NOW(),
         full_name = 'Merged Account',
         email = COALESCE(email, 'merged-' || id || '@panditsuggest.invalid')
   WHERE id = v_holder.id;

  UPDATE users
     SET phone = p_phone, phone_verified = TRUE,
         status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END
   WHERE id = p_into;

  RETURN 'merged';
END;
$$;

REVOKE ALL ON FUNCTION claim_verified_phone(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_verified_phone(TEXT, UUID) TO panditsuggest_app;

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'claim_verified_phone' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'Migration 0005 incomplete — claim_verified_phone missing or not SECURITY DEFINER';
  END IF;
  IF NOT has_function_privilege('panditsuggest_app', 'claim_verified_phone(TEXT, UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 0005 incomplete — app role cannot execute claim_verified_phone';
  END IF;
END
$verify$;
