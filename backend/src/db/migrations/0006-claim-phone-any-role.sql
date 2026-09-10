-- ============================================================================
-- 0006 — claim_verified_phone: drop the target-role guard, fix the return value
-- ============================================================================
-- 0005 refused unless the ABSORBING account was role='devotee'. That was
-- caution rather than a security property, and it made the feature fail for
-- the first real person to use it: the site owner, whose Google account is
-- role='super_admin', got "this number is on a separately reachable account"
-- while looking at their own phone-only account.
--
-- The role of the absorbing account protects nothing:
--
--   * the identity proof is the OTP, which is about the NUMBER, not the role;
--   * the rows that move are the devotee's own reviews, saved pandits and
--     leads — absorbing them grants no privilege the target did not have;
--   * the dangerous direction, a devotee swallowing a staff account, is
--     already refused by the HOLDER guard, which is untouched here: the
--     holder must be a devotee whose ONLY way in is that phone number. A
--     pandit or admin account carries a password or a google_id, so it can
--     never be absorbed.
--
-- Also fixes a real (if cosmetic) bug in 0005's early return: it read FOUND
-- after the UPDATE, so FOUND described the UPDATE rather than the SELECT that
-- looked for a holder, and the two no-op cases both reported 'set'. The
-- holder's existence is captured before the UPDATE now.
--
-- Everything else — the holder guard, what moves, what deliberately does not,
-- the audit trail staying put — is carried over from 0005 unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_verified_phone(p_phone TEXT, p_into UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_holder     users%ROWTYPE;
  v_target     users%ROWTYPE;
  v_had_holder BOOLEAN;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' OR p_into IS NULL THEN
    RAISE EXCEPTION 'claim_verified_phone requires a phone and a user' USING ERRCODE = 'PS001';
  END IF;

  SELECT * INTO v_target FROM users WHERE id = p_into AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target account not found' USING ERRCODE = 'PS001';
  END IF;

  SELECT * INTO v_holder FROM users WHERE phone = p_phone AND deleted_at IS NULL;
  v_had_holder := FOUND;

  -- Nobody holds it, or the caller already does. Just record it.
  IF NOT v_had_holder OR v_holder.id = p_into THEN
    UPDATE users
       SET phone = p_phone, phone_verified = TRUE,
           status = CASE WHEN status = 'pending_verification' THEN 'active' ELSE status END
     WHERE id = p_into;
    RETURN CASE WHEN v_had_holder THEN 'already_own' ELSE 'set' END;
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

  -- ---- collision-prone moves ------------------------------------------
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

  -- Sessions, OTP rows and the security audit log stay where they happened.
  UPDATE user_sessions SET revoked_at = NOW()
   WHERE user_id = v_holder.id AND revoked_at IS NULL;

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
    RAISE EXCEPTION 'Migration 0006 incomplete — claim_verified_phone missing or not SECURITY DEFINER';
  END IF;
  -- The whole point of this migration: the target-role guard is gone.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'claim_verified_phone'
       AND pg_get_functiondef(p.oid) LIKE '%Only a devotee account can absorb%'
  ) THEN
    RAISE EXCEPTION 'Migration 0006 incomplete — the target-role guard is still in place';
  END IF;
  IF NOT has_function_privilege('panditsuggest_app', 'claim_verified_phone(TEXT, UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Migration 0006 incomplete — app role cannot execute claim_verified_phone';
  END IF;
END
$verify$;
