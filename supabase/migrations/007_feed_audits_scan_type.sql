-- Add the missing scan_type column to feed_audits.
--
-- The client (apps/mobile/app/(tabs)/audit.tsx -> createFeedAudit) has been
-- passing scan_type: 'haiku' to every INSERT since the Haiku pipeline shipped,
-- but the column was never added to the schema. PostgREST rejects inserts
-- containing unknown columns with a 400 ("Could not find the 'scan_type'
-- column of 'feed_audits' in the schema cache"). createFeedAudit wasn't
-- surfacing the error — it returned `{ data: null }`, so addAudit() never
-- fired, currentAudit stayed null, and the audit UI rendered the zero
-- fallback for every stat (FRAMES 0, FLAGGED 0, CLEAN 0, big score 0) while
-- AI Insights still showed because it reads from a different store slice.
--
-- This is the actual root cause of the "big 0 but AI adjusted score 72"
-- screenshots — not the merge logic, not the recompute formula, not the
-- missing UPDATE RLS. Those were all real fixes, but this INSERT failure
-- was the reason none of them appeared to do anything.
--
-- Nullable on purpose: pre-Haiku rows already in the DB don't have this
-- value. Default to 'haiku' for convenience on future inserts that forget
-- to include it.

BEGIN;

ALTER TABLE feed_audits
  ADD COLUMN IF NOT EXISTS scan_type TEXT DEFAULT 'haiku';

-- Backfill any existing rows that came in before this column existed.
-- (Legacy total_scanned>30 rows were already purged in migration 005.)
UPDATE feed_audits
SET scan_type = 'haiku'
WHERE scan_type IS NULL;

COMMIT;
