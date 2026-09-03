-- ============================================================================
-- Module 36: Admin-managed page images (site image slots)
-- ============================================================================
-- The public pages still carried hardcoded image URLs: the homepage trust
-- portrait, the /pandits, /temples and /services heroes, the two CSS
-- backdrops on the homepage, and the service category / tile fallbacks. Some
-- pointed at files sitting on the web server's own disk (public/assets/img),
-- the rest at an S3 `static/` prefix that was populated by hand and had no
-- admin surface at all. Either way, replacing one was a code change.
--
-- This table gives each of those images a stable slot key an admin can
-- upload into (Admin Panel -> Page Images). Uploads follow the same path as
-- every other media upload — optimized to WebP, stored in S3 under the
-- `site/` prefix, never on the server's filesystem.
--
-- One row per slot (slot_key is the primary key): a slot holds exactly one
-- current image, and re-uploading replaces it. That is why this is not
-- modelled like home_hero_images, which is an ordered gallery.
--
-- The catalog of valid slot keys lives in backend/src/config/siteImageSlots.js,
-- not in a CHECK constraint here: adding a page image should not need a
-- migration, and a row for a key that no longer exists is simply never read.
--
-- Idempotent.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS site_images (
    slot_key        VARCHAR(64) PRIMARY KEY,
    image_url       TEXT NOT NULL,
    -- Raw S3 object key ("site/<random>.webp"), kept alongside the URL for the
    -- same reason as every other media row — see db/26-media-storage-keys.sql.
    image_key       TEXT,
    alt_text        VARCHAR(200),

    mime_type       VARCHAR(50),
    file_size_bytes BIGINT,
    uploaded_by     UUID REFERENCES users(id),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  site_images IS 'One admin-uploaded image per page slot; keys defined in src/config/siteImageSlots.js.';
COMMENT ON COLUMN site_images.slot_key IS 'e.g. home.trust, pandits.hero, services.fallback_puja.';

COMMIT;

-- ============================================================================
-- Row-Level Security
-- ============================================================================
-- Public editorial content: world-readable, admin-writable — the same shape
-- as home_hero_images (04-dynamic-content.sql). Enforced by Postgres and not
-- only by the route's requireAdmin.
ALTER TABLE site_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_images_select_public ON site_images;
CREATE POLICY site_images_select_public ON site_images
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS site_images_write_admin ON site_images;
CREATE POLICY site_images_write_admin ON site_images
    FOR ALL USING (current_app_user_is_admin()) WITH CHECK (current_app_user_is_admin());

-- ============================================================================
-- Grants
-- ============================================================================
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'panditconnect_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON site_images TO panditconnect_app;
  END IF;
END
$grants$;

-- ============================================================================
-- Self-check
-- ============================================================================
DO $verify$
BEGIN
  IF to_regclass('public.site_images') IS NULL THEN
    RAISE EXCEPTION 'Migration 36 incomplete — site_images table missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'site_images' AND policyname = 'site_images_write_admin'
  ) THEN
    RAISE EXCEPTION 'Migration 36 incomplete — site_images admin write policy missing';
  END IF;
  RAISE NOTICE 'Migration 36 applied: site_images (admin-managed page images).';
END
$verify$;
