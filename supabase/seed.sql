-- Seed cleanup tasks for Instagram
insert into cleanup_tasks (platform, title, description, instruction_steps, deep_link, difficulty, points, is_premium) values
('instagram', 'Set Sensitive Content to Less', 'Limit suggestive content in your Explore page by changing your content preferences. This single setting change has the biggest impact on what Instagram shows you.',
  '[{"step": 1, "text": "Open Instagram and go to your Profile"}, {"step": 2, "text": "Tap the menu (☰) in the top right"}, {"step": 3, "text": "Go to Settings → Suggested Content"}, {"step": 4, "text": "Tap Sensitive Content"}, {"step": 5, "text": "Select \"Less\" to reduce suggestive content"}]',
  'instagram://settings', 'easy', 20, false),

('instagram', 'Clean Your Explore Page', 'Mark suggestive posts as "Not Interested" to retrain your Explore algorithm. The more you mark, the faster your feed improves.',
  '[{"step": 1, "text": "Open Instagram and tap the Explore (🔍) tab"}, {"step": 2, "text": "Scroll through and find a suggestive or thirst-trap post"}, {"step": 3, "text": "Long-press on the post"}, {"step": 4, "text": "Tap \"Not Interested\""}, {"step": 5, "text": "Repeat for at least 5-10 posts — the more the better!"}]',
  'instagram://explore', 'easy', 15, false),

('instagram', 'Unfollow Suggestive Accounts', 'Review your Following list and remove accounts that post suggestive content. These accounts are the #1 source of thirst content in your feed.',
  '[{"step": 1, "text": "Go to your Profile"}, {"step": 2, "text": "Tap \"Following\""}, {"step": 3, "text": "Sort by \"Least Interacted With\" to find accounts you don''t engage with"}, {"step": 4, "text": "Review each account''s recent posts"}, {"step": 5, "text": "Unfollow any accounts primarily posting suggestive content"}]',
  null, 'medium', 15, false),

('instagram', 'Clear Search History', 'Reset your search-based recommendations by clearing your search history. Old searches can keep feeding suggestive suggestions.',
  '[{"step": 1, "text": "Go to your Profile"}, {"step": 2, "text": "Tap the menu (☰)"}, {"step": 3, "text": "Go to Your Activity → Recent Searches"}, {"step": 4, "text": "Tap \"Clear All\" to wipe your search history"}]',
  null, 'easy', 10, false),

('instagram', 'Review Saved Posts', 'Unsave suggestive content to stop it from influencing your recommendations. Instagram uses your Saved posts to learn what you like.',
  '[{"step": 1, "text": "Go to your Profile"}, {"step": 2, "text": "Tap the menu (☰)"}, {"step": 3, "text": "Go to Saved"}, {"step": 4, "text": "Review each collection for suggestive content"}, {"step": 5, "text": "Unsave any suggestive or thirst-trap posts"}]',
  null, 'medium', 20, true),

('instagram', 'Mute Stories From Suggestive Accounts', 'Mute stories from accounts you follow that post suggestive content without unfollowing them.',
  '[{"step": 1, "text": "Open your Home feed"}, {"step": 2, "text": "Long-press on a story from a suggestive account"}, {"step": 3, "text": "Tap \"Mute\""}, {"step": 4, "text": "Select \"Mute Story\" or \"Mute Story and Posts\""}, {"step": 5, "text": "Repeat for other accounts posting suggestive stories"}]',
  null, 'easy', 10, true);

-- Seed cleanup tasks for TikTok
insert into cleanup_tasks (platform, title, description, instruction_steps, deep_link, difficulty, points, is_premium) values
('tiktok', 'Clean Your For You Page', 'Mark suggestive videos as "Not Interested" to retrain your For You Page. This is the fastest way to clean your TikTok algorithm.',
  '[{"step": 1, "text": "Open TikTok to your For You Page"}, {"step": 2, "text": "When you see a suggestive video, long-press on it"}, {"step": 3, "text": "Tap \"Not Interested\""}, {"step": 4, "text": "You can also tap the share icon → \"Not Interested\""}, {"step": 5, "text": "Repeat for at least 5-10 videos — the more the better!"}]',
  null, 'easy', 15, false),

('tiktok', 'Add Content Filter Keywords', 'Filter out suggestive content by adding keywords to your content preferences. TikTok will hide videos matching these keywords.',
  '[{"step": 1, "text": "Open TikTok and go to your Profile"}, {"step": 2, "text": "Tap the menu (☰) → Settings and Privacy"}, {"step": 3, "text": "Go to Content Preferences"}, {"step": 4, "text": "Tap \"Filter Video Keywords\""}, {"step": 5, "text": "Add keywords like: thirst trap, OnlyFans, link in bio, 18+, suggestive"}, {"step": 6, "text": "Toggle the filter on"}]',
  null, 'easy', 20, false),

('tiktok', 'Unfollow Suggestive Creators', 'Review your Following list and remove creators who primarily post suggestive content.',
  '[{"step": 1, "text": "Go to your Profile"}, {"step": 2, "text": "Tap \"Following\""}, {"step": 3, "text": "Review each creator''s recent videos"}, {"step": 4, "text": "Unfollow those primarily posting suggestive or thirst-trap content"}]',
  null, 'medium', 15, false),

('tiktok', 'Clear Cache and Watch History', 'Reset your recommendations by clearing your TikTok cache and watch history.',
  '[{"step": 1, "text": "Go to your Profile"}, {"step": 2, "text": "Tap the menu (☰)"}, {"step": 3, "text": "Go to Settings and Privacy"}, {"step": 4, "text": "Tap \"Free Up Space\" or \"Clear Cache\""}, {"step": 5, "text": "Also clear your Watch History under \"Watch History\" if available"}]',
  null, 'easy', 10, false),

('tiktok', 'Set Restricted Mode', 'Enable Restricted Mode to limit mature content in your feed. This acts as a safety net alongside your other cleanup efforts.',
  '[{"step": 1, "text": "Go to Settings and Privacy"}, {"step": 2, "text": "Tap \"Content Preferences\""}, {"step": 3, "text": "Enable \"Restricted Mode\""}, {"step": 4, "text": "Set a passcode if desired to prevent accidental changes"}]',
  null, 'easy', 20, false),

('tiktok', 'Reset Your FYP', 'Use TikTok''s official FYP reset to start completely fresh. This is the nuclear option — your entire For You Page will rebuild from scratch.',
  '[{"step": 1, "text": "Go to Settings and Privacy"}, {"step": 2, "text": "Tap \"Content Preferences\""}, {"step": 3, "text": "Look for \"Refresh your For You feed\""}, {"step": 4, "text": "Confirm the reset — this cannot be undone"}, {"step": 5, "text": "Your FYP will rebuild from scratch based on your new interactions"}]',
  null, 'hard', 30, true);

-- Seed challenges
insert into challenges (title, description, platform, action_type, target_count, points, is_premium) values
('Explore Cleanup', 'Tap "Not Interested" on 5 suggestive posts in your Explore page.', 'instagram', 'not_interested', 5, 25, false),
('Unfollow Sweep', 'Unfollow 5 accounts that post suggestive content.', 'instagram', 'unfollow', 5, 30, false),
('Content Settings', 'Set Sensitive Content to "Less" in your Instagram settings.', 'instagram', 'settings', 1, 20, false),
('Search History Purge', 'Clear your Instagram search history.', 'instagram', 'settings', 1, 15, false),
('Saved Posts Review', 'Unsave 10 suggestive posts from your Saved collection.', 'instagram', 'not_interested', 10, 35, true),
('FYP Cleanse', 'Tap "Not Interested" on 5 suggestive FYP videos.', 'tiktok', 'not_interested', 5, 25, false),
('Creator Cleanup', 'Unfollow 5 creators who primarily post suggestive content.', 'tiktok', 'unfollow', 5, 30, false),
('Keyword Filter', 'Add at least 3 keywords to your TikTok content filter.', 'tiktok', 'settings', 1, 20, false),
('Cache Clear', 'Clear your TikTok cache and watch history.', 'tiktok', 'settings', 1, 15, false),
('Feed Audit', 'Do a Feed Audit and find out your Feed Score.', null, 'audit', 1, 20, false),
('Deep Clean', 'Complete 10 cleanup tasks in a single day.', null, 'not_interested', 10, 50, true),
('Beat Your Score', 'Do a new Feed Audit and get a lower score than your previous one.', null, 'audit', 1, 40, false);
