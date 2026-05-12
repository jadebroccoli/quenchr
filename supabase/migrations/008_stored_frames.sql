-- Phase 4A: Opt-in frame retention for proprietary AI training
--
-- Users who consent via Settings > Data & AI Training have flagged scan
-- frames silently uploaded to the 'scan-frames' storage bucket after each
-- scan. Metadata (haiku classification, score, platform, scan_id) is stored
-- here so the training pipeline can retrieve and label them.
--
-- Files live at: {user_id}/{scan_id}/{frame_index}_{timestamp}.jpg
-- Bucket is private — only accessible by the owning user and service role.

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- 512 KB per file (224×224 JPEG ~20-80 KB in practice; 512 KB is generous).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scan-frames',
  'scan-frames',
  false,
  524288,
  array['image/jpeg']
)
on conflict (id) do nothing;

-- Storage RLS: each user can only touch their own folder (first path component = user_id)
create policy "Users can upload own scan frames"
  on storage.objects for insert
  with check (
    bucket_id = 'scan-frames'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view own scan frames"
  on storage.objects for select
  using (
    bucket_id = 'scan-frames'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own scan frames"
  on storage.objects for delete
  using (
    bucket_id = 'scan-frames'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Table ─────────────────────────────────────────────────────────────────────
create table stored_frames (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references users(id) on delete cascade,
  scan_id         uuid        references feed_audits(id) on delete set null,
  storage_path    text        not null,       -- bucket-relative path
  platform        text        not null,       -- 'instagram' | 'tiktok'
  haiku_category  text,                       -- 'clean' | 'mild' | 'suggestive' | 'explicit'
  haiku_score     numeric(5,2),               -- 0-100 suggestive intensity
  user_correction text,                       -- future: manual label override
  created_at      timestamptz not null default now()
);

create index idx_stored_frames_user    on stored_frames(user_id);
create index idx_stored_frames_scan    on stored_frames(scan_id);
create index idx_stored_frames_created on stored_frames(created_at);

-- ── Row-Level Security ────────────────────────────────────────────────────────
alter table stored_frames enable row level security;

create policy "Users can view own stored frames"
  on stored_frames for select
  using (auth.uid() = user_id);

create policy "Users can insert own stored frames"
  on stored_frames for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own stored frames"
  on stored_frames for delete
  using (auth.uid() = user_id);

-- Service role (used by training pipeline) can read everything — no policy needed
-- as service role bypasses RLS. No public read policy is intentional.
