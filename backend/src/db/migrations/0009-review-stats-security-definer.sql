-- ============================================================================
-- 0009 — make the review-stats trigger able to write the row it summarises
-- ============================================================================
-- A pandit with two approved five-star reviews was showing 0.0 on every card
-- and in the directory. The reviews were fine — right reviewable_id, is_approved
-- true, not deleted. What never happened was the write to pandits.avg_rating.
--
-- update_pandit_review_stats() is an AFTER INSERT/UPDATE/DELETE trigger on
-- `reviews` that recomputes pandits.review_count / avg_rating (and the same
-- pair on temples). It was NOT security definer, so its
--
--     UPDATE pandits SET avg_rating = ... WHERE id = v_id
--
-- ran as whoever wrote the review — a devotee. `pandits` allows UPDATE only to
-- the pandit themselves (pandits_update_self) or an admin
-- (pandits_update_admin), so for a devotee the statement matched zero rows.
-- RLS filters rows out of an UPDATE rather than raising, so nothing failed and
-- nothing was logged: the review saved, the rating silently stayed 0.00.
--
-- Reviews are created already approved, so the INSERT was the only trigger
-- firing, and no later admin UPDATE ever came along to fix the number.
--
-- The fix is to run the recompute as the owner. That is safe because the
-- function takes nothing from the caller: it reads the trigger row's own
-- reviewable_id and recomputes the aggregate from `reviews` itself, applying
-- the same is_approved / deleted_at filter it always did. It cannot be pointed
-- at an arbitrary row, and it writes only these two derived columns.
-- search_path is pinned, as it must be for anything security definer.
--
-- Body is otherwise carried over from the original unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_pandit_review_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

-- ----------------------------------------------------------------------------
-- Backfill
-- ----------------------------------------------------------------------------
-- Every rating written while the trigger was a no-op is still wrong, and no
-- future review on those rows would correct the ones already missed. Recompute
-- the lot from `reviews`, which has been the truth throughout.
UPDATE pandits p SET
  review_count = (SELECT COUNT(*) FROM reviews r
                   WHERE r.reviewable_type = 'pandit' AND r.reviewable_id = p.id
                     AND r.is_approved = TRUE AND r.deleted_at IS NULL),
  avg_rating   = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r
                   WHERE r.reviewable_type = 'pandit' AND r.reviewable_id = p.id
                     AND r.is_approved = TRUE AND r.deleted_at IS NULL);

UPDATE temples t SET
  review_count = (SELECT COUNT(*) FROM reviews r
                   WHERE r.reviewable_type = 'temple' AND r.reviewable_id = t.id
                     AND r.is_approved = TRUE AND r.deleted_at IS NULL),
  avg_rating   = (SELECT COALESCE(AVG(r.rating), 0) FROM reviews r
                   WHERE r.reviewable_type = 'temple' AND r.reviewable_id = t.id
                     AND r.is_approved = TRUE AND r.deleted_at IS NULL);

-- rank_score feeds the directory ordering and is derived from the rating that
-- was just corrected, so it has to be recomputed for anything that moved.
UPDATE pandits SET rank_score = calculate_pandit_rank(id) WHERE review_count > 0;

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE stale INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'update_pandit_review_stats' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'Migration 0009 incomplete — update_pandit_review_stats is not SECURITY DEFINER';
  END IF;

  -- No pandit may still read 0 reviews while approved reviews exist for them.
  SELECT COUNT(*) INTO stale
    FROM pandits p
   WHERE p.review_count <> (SELECT COUNT(*) FROM reviews r
                             WHERE r.reviewable_type = 'pandit' AND r.reviewable_id = p.id
                               AND r.is_approved = TRUE AND r.deleted_at IS NULL);
  IF stale > 0 THEN
    RAISE EXCEPTION 'Migration 0009 incomplete — % pandit(s) still carry a stale review_count', stale;
  END IF;
END
$verify$;
