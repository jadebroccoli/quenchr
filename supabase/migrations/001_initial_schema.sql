-- Quenchr initial schema

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── Users ──
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'pro')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── User Platforms ──
create table user_platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  platform text not null
    check (platform in ('instagram', 'tiktok', 'twitter', 'reddit', 'youtube')),
  active boolean not null default true,
  added_at timestamptz not null default now(),
  unique(user_id, platform)
);

create index idx_user_platforms_user on user_platforms(user_id);

-- ── Feed Audits ──
create table feed_audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  platform text not null,
  total_scanned int not null,
  nsfw_detected int not null,
  sexy_detected int not null,
  neutral_detected int not null,
  feed_score numeric(5,2) not null,
  created_at timestamptz not null default now()
);

create index idx_feed_audits_user on feed_audits(user_id);
create index idx_feed_audits_user_platform on feed_audits(user_id, platform);

-- ── Cleanup Tasks (templates) ──
create table cleanup_tasks (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  title text not null,
  description text not null,
  instruction_steps jsonb not null default '[]'::jsonb,
  deep_link text,
  difficulty text not null default 'easy'
    check (difficulty in ('easy', 'medium', 'hard')),
  points int not null default 10,
  is_premium boolean not null default false
);

-- ── User Cleanup Progress ──
create table user_cleanup_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  task_id uuid not null references cleanup_tasks(id),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_user_cleanup_user on user_cleanup_progress(user_id);

-- ── Streaks ──
create table streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade unique,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_activity_date date,
  total_points int not null default 0
);

-- ── Challenges (templates) ──
create table challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  platform text,
  action_type text not null,
  target_count int not null default 1,
  points int not null default 25,
  is_premium boolean not null default false
);

-- ── User Challenges ──
create table user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  challenge_id uuid not null references challenges(id),
  progress int not null default 0,
  completed boolean not null default false,
  assigned_date date not null default current_date,
  completed_at timestamptz
);

create index idx_user_challenges_user on user_challenges(user_id);
create index idx_user_challenges_date on user_challenges(user_id, assigned_date);

-- ── Row Level Security ──
alter table users enable row level security;
alter table user_platforms enable row level security;
alter table feed_audits enable row level security;
alter table user_cleanup_progress enable row level security;
alter table streaks enable row level security;
alter table user_challenges enable row level security;

-- Users can only read/update their own row
create policy "Users can view own profile"
  on users for select using (auth.uid() = id);
create policy "Users can update own profile"
  on users for update using (auth.uid() = id);

-- User platforms
create policy "Users can manage own platforms"
  on user_platforms for all using (auth.uid() = user_id);

-- Feed audits
create policy "Users can view own audits"
  on feed_audits for select using (auth.uid() = user_id);
create policy "Users can create own audits"
  on feed_audits for insert with check (auth.uid() = user_id);

-- Cleanup progress
create policy "Users can manage own cleanup progress"
  on user_cleanup_progress for all using (auth.uid() = user_id);

-- Streaks
create policy "Users can manage own streaks"
  on streaks for all using (auth.uid() = user_id);

-- User challenges
create policy "Users can manage own challenges"
  on user_challenges for all using (auth.uid() = user_id);

-- Cleanup tasks and challenges are readable by all authenticated users
alter table cleanup_tasks enable row level security;
alter table challenges enable row level security;

create policy "Authenticated users can read cleanup tasks"
  on cleanup_tasks for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read challenges"
  on challenges for select using (auth.role() = 'authenticated');

-- ── Function: Create user profile on signup ──
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);

  insert into public.streaks (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
