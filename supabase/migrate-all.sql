-- ════════════════════════════════════════════════════════════════════
-- Cricket Empire — consolidated migration.
-- Run this ONCE in the Supabase SQL editor. It is safe to re-run (idempotent).
-- Brings an existing DB up to date: user-id types, season stats, career stats,
-- and the Hall of Fame table.
-- ════════════════════════════════════════════════════════════════════

-- 1) User ids → TEXT (works for Supabase Auth UUIDs + dev ids)
alter table ce_clubs drop constraint if exists ce_clubs_owner_user_id_fkey;
alter table ce_clubs alter column owner_user_id type text using owner_user_id::text;

-- ce_users: rebuild as text-id (drop FK-less, recreate columns if needed)
do $$
begin
  begin
    alter table ce_users alter column id drop default;
  exception when others then null;
  end;
  begin
    alter table ce_users alter column id type text using id::text;
  exception when others then null;
  end;
end $$;

-- 2) Club season-stats columns
alter table ce_clubs add column if not exists season_won int not null default 0;
alter table ce_clubs add column if not exists season_lost int not null default 0;
alter table ce_clubs add column if not exists season_tied int not null default 0;
alter table ce_clubs add column if not exists season_points int not null default 0;
alter table ce_clubs add column if not exists season_runs_for bigint not null default 0;
alter table ce_clubs add column if not exists season_balls_for bigint not null default 0;
alter table ce_clubs add column if not exists season_runs_against bigint not null default 0;
alter table ce_clubs add column if not exists season_balls_against bigint not null default 0;
alter table ce_clubs add column if not exists match_orders jsonb;
alter table ce_clubs add column if not exists crest jsonb;

-- 3) Player career-stats columns
alter table ce_players add column if not exists career jsonb;
alter table ce_players add column if not exists debut_week int;

-- 4) Hall of Fame table
create table if not exists ce_hall_of_fame (
  id              text primary key,
  name            text not null,
  role            text,
  bowler_type     text,
  batting_hand    text,
  retired_age     int,
  retired_week    int,
  debut_week      int,
  last_club_id    text,
  last_club_name  text,
  peak_skill_index int,
  career          jsonb,
  created_at      timestamptz not null default now()
);
alter table ce_hall_of_fame enable row level security;
do $$
begin
  create policy ce_public_read_hof on ce_hall_of_fame for select using (true);
exception when duplicate_object then null;
end $$;
