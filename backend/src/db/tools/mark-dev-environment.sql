-- ============================================================================
-- Marks this database as a development environment (docker compose only)
-- ============================================================================
-- Runs last, after the baseline has created deployment_environment. Gives the
-- test guard's fourth layer (src/config/testDbGuard.js) something to read, and
-- means a dev dump restored somewhere else still identifies itself honestly
-- rather than being mistaken for production.
INSERT INTO public.deployment_environment (environment, note)
VALUES ('development', 'docker compose local stack')
ON CONFLICT (id) DO UPDATE SET environment = EXCLUDED.environment, note = EXCLUDED.note;
