-- Add unique constraint to prevent duplicate progress entries.
-- The completeCleanupTask() query uses upsert with onConflict,
-- which requires this constraint to work correctly.
ALTER TABLE user_cleanup_progress
  ADD CONSTRAINT uq_user_cleanup_progress_user_task UNIQUE (user_id, task_id);
