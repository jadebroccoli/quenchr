-- Add UPDATE RLS policy for feed_audits.
--
-- Root cause of "big score shows 0 but AI adjusted score shows 72":
-- The original 001_initial_schema.sql defined SELECT and INSERT policies
-- for feed_audits but forgot UPDATE. Every updateFeedAudit() call from
-- the client has been silently rejected by RLS (postgres treats missing
-- UPDATE policy as "deny all"). That's why the adjusted/recomputed score
-- never made it back to the DB, and why Supabase's .update().select()
-- returned 0 rows after we tried — causing the old overwrite-currentAudit
-- bug that nuked total_scanned / nsfw_detected on the store.
--
-- DELETE is similarly missing. Adding it too so the legacy-purge
-- migration pattern keeps working for future housekeeping.

BEGIN;

DROP POLICY IF EXISTS "Users can update own audits" ON feed_audits;
CREATE POLICY "Users can update own audits"
  ON feed_audits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own audits" ON feed_audits;
CREATE POLICY "Users can delete own audits"
  ON feed_audits
  FOR DELETE
  USING (auth.uid() = user_id);

-- Clean up broken rows that accumulated while UPDATE was silently blocked.
-- total_scanned=0 is unambiguously broken: scanWithHaiku() throws
-- "AI scan returned no results" when total_frames is 0, so any row with
-- total_scanned=0 was never a real scan — it's residue from a partial
-- write or a client that passed bad data.
DO $$
DECLARE
  broken_count INT;
BEGIN
  SELECT COUNT(*) INTO broken_count
  FROM feed_audits
  WHERE total_scanned = 0;
  RAISE NOTICE 'Deleting % broken audit row(s) with total_scanned = 0', broken_count;
END $$;

DELETE FROM ai_insights
WHERE audit_id IN (SELECT id FROM feed_audits WHERE total_scanned = 0);

DELETE FROM feed_audits WHERE total_scanned = 0;

COMMIT;
