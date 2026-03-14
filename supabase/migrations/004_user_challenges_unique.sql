-- Prevent duplicate daily challenge assignments if the hook runs twice
ALTER TABLE user_challenges
  ADD CONSTRAINT uq_user_challenges_user_challenge_date UNIQUE (user_id, challenge_id, assigned_date);
