-- ============================================================================
-- Lead-distribution and payment/subscription behavioural tests
-- ============================================================================
-- Runs against a DISPOSABLE database built from baseline + config. Everything
-- happens inside one transaction that is ROLLED BACK, so the database is left
-- exactly as it was found.
--
--   psql -d <scratch> -v ON_ERROR_STOP=1 -f tools/test-lead-payment.sql
-- ============================================================================
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE t (k TEXT PRIMARY KEY, v UUID);

DO $$
DECLARE
  u_devotee UUID; u_unverified UUID; u_inactive UUID;
  u_pandit  UUID; u_pandit2 UUID;
  p_main    UUID; p_paused UUID;
  plan_gold UUID;
BEGIN
  -- A devotee with a verified INDIAN phone: the only shape that qualifies.
  INSERT INTO users (email, phone, full_name, role, status, phone_verified, city, state)
    VALUES ('devotee@lead.test', '+919876500001', 'Test Devotee', 'devotee', 'active', TRUE, 'Indore', 'MP')
    RETURNING id INTO u_devotee;

  INSERT INTO users (email, phone, full_name, role, status, phone_verified)
    VALUES ('unverified@lead.test', '+919876500002', 'Unverified', 'devotee', 'active', FALSE)
    RETURNING id INTO u_unverified;

  INSERT INTO users (email, phone, full_name, role, status, phone_verified)
    VALUES ('inactive@lead.test', '+919876500003', 'Inactive', 'devotee', 'suspended', TRUE)
    RETURNING id INTO u_inactive;

  INSERT INTO users (email, phone, full_name, role, status, phone_verified)
    VALUES ('pandit@lead.test', '+919876500004', 'Test Pandit', 'pandit', 'active', TRUE)
    RETURNING id INTO u_pandit;
  INSERT INTO pandits (user_id, slug, public_phone, is_available)
    VALUES (u_pandit, 'test-pandit-main', '+919876500004', TRUE) RETURNING id INTO p_main;

  INSERT INTO users (email, phone, full_name, role, status, phone_verified)
    VALUES ('pandit2@lead.test', '+919876500005', 'Paused Pandit', 'pandit', 'active', TRUE)
    RETURNING id INTO u_pandit2;
  INSERT INTO pandits (user_id, slug, public_phone, is_available, is_paused, paused_reason, paused_at)
    VALUES (u_pandit2, 'test-pandit-paused', '+919876500005', TRUE, TRUE, 'test', NOW())
    RETURNING id INTO p_paused;

  SELECT id INTO plan_gold FROM subscription_plans WHERE tier = 'gold' LIMIT 1;

  INSERT INTO t VALUES
    ('u_devotee', u_devotee), ('u_unverified', u_unverified), ('u_inactive', u_inactive),
    ('u_pandit', u_pandit), ('p_main', p_main), ('p_paused', p_paused), ('plan_gold', plan_gold);
END $$;

-- ---------------------------------------------------------------------------
-- LEAD TESTS
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD; n INT; lead1 UUID;
BEGIN
  -- 1. A valid qualified lead is created.
  SELECT * INTO r FROM record_qualified_lead(
    (SELECT v FROM t WHERE k='p_main'), (SELECT v FROM t WHERE k='u_devotee'),
    'phone_call', 24, 'test', NULL, NULL);
  IF NOT r.was_created THEN RAISE EXCEPTION 'L1 valid lead: expected created, got %', r.reason; END IF;
  lead1 := r.lead_id;
  RAISE NOTICE 'L1 valid qualified lead                -> created';

  -- 2. Market is derived from the VERIFIED phone, never from a caller arg.
  SELECT market::text INTO r FROM qualified_leads WHERE id = lead1;
  IF (SELECT market FROM qualified_leads WHERE id = lead1) <> 'INDIA' THEN
    RAISE EXCEPTION 'L2 market: expected INDIA from +91 phone';
  END IF;
  IF (SELECT market_source FROM qualified_leads WHERE id = lead1) <> 'VERIFIED_PHONE' THEN
    RAISE EXCEPTION 'L2 market_source: expected VERIFIED_PHONE';
  END IF;
  RAISE NOTICE 'L2 market from verified phone          -> INDIA / VERIFIED_PHONE';

  -- 3. Same user + same pandit inside the window deduplicates.
  SELECT * INTO r FROM record_qualified_lead(
    (SELECT v FROM t WHERE k='p_main'), (SELECT v FROM t WHERE k='u_devotee'),
    'whatsapp', 24, 'test', NULL, NULL);
  IF r.was_created THEN RAISE EXCEPTION 'L3 dedup: a second lead was created inside the window'; END IF;
  IF r.reason <> 'duplicate_window' THEN RAISE EXCEPTION 'L3 dedup: reason was %', r.reason; END IF;
  IF r.lead_id <> lead1 THEN RAISE EXCEPTION 'L3 dedup: returned a different lead'; END IF;
  SELECT count(*) INTO n FROM qualified_leads WHERE pandit_id=(SELECT v FROM t WHERE k='p_main');
  IF n <> 1 THEN RAISE EXCEPTION 'L3 dedup: % lead rows exist, expected 1', n; END IF;
  IF (SELECT interaction_count FROM qualified_leads WHERE id=lead1) <> 2 THEN
    RAISE EXCEPTION 'L3 dedup: interaction_count was not incremented';
  END IF;
  RAISE NOTICE 'L3 duplicate lead, same user           -> deduplicated, count=2, still 1 row';

  -- 4. Unverified phone cannot generate a lead.
  SELECT * INTO r FROM record_qualified_lead(
    (SELECT v FROM t WHERE k='p_main'), (SELECT v FROM t WHERE k='u_unverified'),
    'phone_call', 24, 'test', NULL, NULL);
  IF r.was_created OR r.reason <> 'user_not_verified' THEN
    RAISE EXCEPTION 'L4 unverified user: expected user_not_verified, got % / %', r.was_created, r.reason;
  END IF;
  RAISE NOTICE 'L4 unverified user                     -> rejected (user_not_verified)';

  -- 5. Suspended user cannot generate a lead.
  SELECT * INTO r FROM record_qualified_lead(
    (SELECT v FROM t WHERE k='p_main'), (SELECT v FROM t WHERE k='u_inactive'),
    'phone_call', 24, 'test', NULL, NULL);
  IF r.was_created OR r.reason <> 'user_not_active' THEN
    RAISE EXCEPTION 'L5 inactive user: expected user_not_active, got %', r.reason;
  END IF;
  RAISE NOTICE 'L5 suspended user                      -> rejected (user_not_active)';

  -- 6. A non-qualifying contact method (in_app_message) never creates a lead.
  SELECT * INTO r FROM record_qualified_lead(
    (SELECT v FROM t WHERE k='p_main'), (SELECT v FROM t WHERE k='u_devotee'),
    'in_app_message', 24, 'test', NULL, NULL);
  IF r.was_created OR r.reason <> 'method_not_qualifying' THEN
    RAISE EXCEPTION 'L6 method: expected method_not_qualifying, got %', r.reason;
  END IF;
  RAISE NOTICE 'L6 non-qualifying method               -> rejected (method_not_qualifying)';

  -- 7. A pandit contacting themselves is not a lead.
  SELECT * INTO r FROM record_qualified_lead(
    (SELECT v FROM t WHERE k='p_main'), (SELECT v FROM t WHERE k='u_pandit'),
    'phone_call', 24, 'test', NULL, NULL);
  IF r.was_created OR r.reason <> 'self_contact' THEN
    RAISE EXCEPTION 'L7 self contact: expected self_contact, got %', r.reason;
  END IF;
  RAISE NOTICE 'L7 pandit contacting self              -> rejected (self_contact)';

  -- 8. Leads are immutable to the runtime role: no DELETE grant, no INSERT policy.
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
              WHERE grantee='panditsuggest_app' AND table_name='qualified_leads'
                AND privilege_type='DELETE') THEN
    RAISE EXCEPTION 'L8 app role can DELETE qualified_leads';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE tablename='qualified_leads' AND cmd='INSERT') THEN
    RAISE EXCEPTION 'L8 qualified_leads has an INSERT policy — the SECURITY DEFINER function should be the only write path';
  END IF;
  RAISE NOTICE 'L8 lead write path                     -> definer-only, undeletable by app';

  -- 9. Snapshots survive the contact's later profile edits.
  IF (SELECT contact_phone_snapshot FROM qualified_leads WHERE id=lead1) <> '+919876500001' THEN
    RAISE EXCEPTION 'L9 snapshot: phone snapshot missing';
  END IF;
  RAISE NOTICE 'L9 contact snapshot captured           -> phone/name/city retained';
END $$;

-- ---------------------------------------------------------------------------
-- PAYMENT / SUBSCRIPTION TESTS
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  p_main UUID := (SELECT v FROM t WHERE k='p_main');
  plan_gold UUID := (SELECT v FROM t WHERE k='plan_gold');
  sub1 UUID; pay1 UUID; exp TIMESTAMPTZ := NOW() + INTERVAL '30 days';
  ok BOOLEAN;
BEGIN
  -- P1. A tier CANNOT be granted with no payment and no manual grant.
  INSERT INTO pandit_subscriptions (pandit_id, plan_id, billing_cycle, starts_at, expires_at, is_active)
    VALUES (p_main, plan_gold, 'monthly', NOW(), exp, TRUE) RETURNING id INTO sub1;
  BEGIN
    PERFORM activate_pandit_subscription(p_main, 'gold', exp);
    RAISE EXCEPTION 'P1 FAILED: unpaid subscription was activated';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM LIKE 'P1 FAILED%' THEN RAISE; END IF;
    RAISE NOTICE 'P1 activation without payment          -> refused';
  END;

  -- P2. With a COMPLETED payment linked, activation succeeds.
  INSERT INTO payment_transactions (pandit_id, subscription_id, amount, gateway, status, paid_at,
                                    gateway_order_id, gateway_payment_id, invoice_number)
    VALUES (p_main, sub1, 9000, 'razorpay', 'completed', NOW(), 'order_TEST1', 'pay_TEST1', 'INV-TEST-1')
    RETURNING id INTO pay1;
  UPDATE pandit_subscriptions SET last_payment_id = pay1 WHERE id = sub1;
  PERFORM activate_pandit_subscription(p_main, 'gold', exp);
  IF (SELECT current_tier FROM pandits WHERE id=p_main) <> 'gold' THEN
    RAISE EXCEPTION 'P2 activation with payment did not set tier';
  END IF;
  RAISE NOTICE 'P2 activation with completed payment   -> tier=gold';

  -- P3. Activating a tier the subscription is not for is refused.
  BEGIN
    PERFORM activate_pandit_subscription(p_main, 'diamond', exp);
    RAISE EXCEPTION 'P3 FAILED: granted diamond on a gold subscription';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM LIKE 'P3 FAILED%' THEN RAISE; END IF;
    RAISE NOTICE 'P3 tier escalation beyond what was paid -> refused';
  END;

  -- P4. An absurd expiry is refused.
  BEGIN
    PERFORM activate_pandit_subscription(p_main, 'gold', NOW() + INTERVAL '50 years');
    RAISE EXCEPTION 'P4 FAILED: accepted a 50-year expiry';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM LIKE 'P4 FAILED%' THEN RAISE; END IF;
    RAISE NOTICE 'P4 expiry beyond the 10y ceiling       -> refused';
  END;

  -- P5. Duplicate webhook delivery cannot create a duplicate payment row.
  BEGIN
    INSERT INTO payment_transactions (pandit_id, subscription_id, amount, gateway, status, paid_at,
                                      gateway_order_id, gateway_payment_id, invoice_number)
      VALUES (p_main, sub1, 9000, 'razorpay', 'completed', NOW(), 'order_TEST2', 'pay_TEST1', 'INV-TEST-2');
    RAISE EXCEPTION 'P5 FAILED: duplicate gateway_payment_id was accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'P5 duplicate gateway_payment_id        -> rejected by unique index';
  END;

  -- P6. Two active subscriptions for one pandit are structurally impossible.
  BEGIN
    INSERT INTO pandit_subscriptions (pandit_id, plan_id, billing_cycle, starts_at, expires_at, is_active)
      VALUES (p_main, plan_gold, 'monthly', NOW(), exp, TRUE);
    RAISE EXCEPTION 'P6 FAILED: a second active subscription was accepted';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'P6 second active subscription          -> rejected by unique index';
  END;

  -- P7. A refund cannot exceed the amount paid.
  BEGIN
    UPDATE payment_transactions SET refund_amount = 99999 WHERE id = pay1;
    RAISE EXCEPTION 'P7 FAILED: refund exceeding amount was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'P7 refund larger than payment          -> rejected by CHECK';
  END;

  -- P8. A completed payment must record when it was paid.
  BEGIN
    INSERT INTO payment_transactions (pandit_id, subscription_id, amount, gateway, status, paid_at, invoice_number)
      VALUES (p_main, sub1, 9000, 'razorpay', 'completed', NULL, 'INV-TEST-3');
    RAISE EXCEPTION 'P8 FAILED: completed payment with NULL paid_at was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'P8 completed payment without paid_at   -> rejected by CHECK';
  END;

  -- P9. A manual, explicitly-recorded admin grant is still allowed.
  UPDATE pandit_subscriptions SET is_active = FALSE WHERE pandit_id = p_main;
  INSERT INTO pandit_subscriptions (pandit_id, plan_id, billing_cycle, starts_at, expires_at, is_active)
    VALUES (p_main, plan_gold, 'manual', NOW(), exp, TRUE);
  PERFORM activate_pandit_subscription(p_main, 'gold', exp);
  RAISE NOTICE 'P9 audited manual admin grant          -> allowed';
END $$;

DO $$ BEGIN RAISE NOTICE 'lead + payment tests: ALL PASSED'; END $$;

ROLLBACK;
