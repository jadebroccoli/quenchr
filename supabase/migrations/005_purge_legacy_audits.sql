-- Purge legacy feed_audits that came from pre-Haiku scan paths.
--
-- Why: Current scan pipeline (Haiku edge function) caps frames at 30 per
-- scan, so any row with total_scanned > 30 is from an older NSFWJS-only
-- path that classified every extracted frame locally. Those rows pollute
-- the score sparkline + audit history with misleading counts and scores
-- that were computed under a different formula.
--
-- Impact: Deletes historical audit rows only. Live data (users, platforms,
-- cleanup progress, challenges, streaks) is untouched. ai_insights rows
-- referencing deleted audits are cascaded via FK ON DELETE CASCADE if set;
-- otherwise they remain as orphans (harmless).

BEGIN;

-- Log what we're about to delete (shows in migration output).
DO $$
DECLARE
  legacy_count INT;
BEGIN
  SELECT COUNT(*) INTO legacy_count
  FROM feed_audits
  WHERE total_scanned > 30;
  RAISE NOTICE 'Purging % legacy audit row(s) with total_scanned > 30', legacy_count;
END $$;

-- Cascade-clean any ai_insights rows tied to those legacy audits first,
-- in case the FK is not set with ON DELETE CASCADE.
DELETE FROM ai_insights
WHERE audit_id IN (
  SELECT id FROM feed_audits WHERE total_scanned > 30
);

DELETE FROM feed_audits
WHERE total_scanned > 30;

COMMIT;
