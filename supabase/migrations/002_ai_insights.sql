-- Phase 2C: AI Insights table for persisting Claude Haiku analysis results

create table ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  audit_id uuid references feed_audits(id) on delete set null,
  platform text not null,
  insights_json jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_ai_insights_user on ai_insights(user_id);
create index idx_ai_insights_audit on ai_insights(audit_id);

-- RLS
alter table ai_insights enable row level security;

create policy "Users can view own AI insights"
  on ai_insights for select
  using (auth.uid() = user_id);

-- Insert allowed for service role (Edge Function uses service role key)
create policy "Service role can insert AI insights"
  on ai_insights for insert
  with check (true);
