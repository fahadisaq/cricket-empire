-- Cricket Empire — database schema.
-- Run this in the Supabase SQL Editor once after creating the project.
-- All tables are prefixed `ce_` so this game can safely share a project.

-- ───────────────────────── Users / managers ─────────────────────────
create table if not exists ce_users (
  id            text primary key,            -- Supabase auth user id (uuid as text) or dev anon id
  display_name  text not null,
  created_at    timestamptz not null default now()
);

-- ───────────────────────── World singleton ─────────────────────────
-- One row holds global world meta (seed + current week / tick counter).
create table if not exists ce_world (
  id         int primary key default 1,
  seed       bigint not null,
  week       int not null default 0,
  updated_at timestamptz not null default now(),
  constraint ce_world_single check (id = 1)
);

-- ───────────────────────── Leagues ─────────────────────────
create table if not exists ce_leagues (
  id            text primary key,
  name          text not null,
  division_tier int not null default 1
);

-- ───────────────────────── Clubs ─────────────────────────
create table if not exists ce_clubs (
  id                       text primary key,
  name                     text not null,
  manager_type             text not null default 'ai',     -- 'ai' | 'human'
  owner_user_id            text,
  personality              text not null,
  balance                  bigint not null default 0,
  stadium_seats            int not null default 8000,
  pitch_type               text not null default 'sporting',
  fan_club                 int not null default 5000,
  division_tier            int not null default 1,
  league_id                text references ce_leagues(id) on delete set null,
  reputation_points        int not null default 0,
  season_won               int not null default 0,
  season_lost              int not null default 0,
  season_tied              int not null default 0,
  season_points            int not null default 0,
  season_runs_for          bigint not null default 0,
  season_balls_for         bigint not null default 0,
  season_runs_against      bigint not null default 0,
  season_balls_against     bigint not null default 0,
  training_focus           text not null default 'batting',
  training_facility_level  int not null default 1,
  scout_country            text not null default 'India',
  pending_scout_player_id  text,
  -- Human-submitted match orders (overrides AI when present); null = use AI.
  match_orders             jsonb,
  crest                    jsonb
);
create index if not exists ce_clubs_owner_idx on ce_clubs(owner_user_id);
create index if not exists ce_clubs_league_idx on ce_clubs(league_id);

-- ───────────────────────── Players ─────────────────────────
-- Every player — AI-owned and human-owned — is stored identically here.
create table if not exists ce_players (
  id              text primary key,
  club_id         text references ce_clubs(id) on delete set null,
  name            text not null,
  age             int not null,
  role            text not null,
  batting_hand    text not null,
  bowler_type     text not null,
  -- Skills 0..100
  bat_vs_seam     real not null,
  bat_vs_spin     real not null,
  bowl_main       real not null,
  bowl_variation  real not null,
  fielding        real not null,
  wicketkeeping   real not null,
  -- Dynamic
  fitness         real not null,
  form            real not null,
  experience      real not null,
  potential       real not null,
  salary          int not null,
  -- Lifetime career stats (JSON) + debut week
  career          jsonb,
  debut_week      int,
  -- For PTF accounting
  acq_week        int,
  acq_price       bigint
);
create index if not exists ce_players_club_idx on ce_players(club_id);

-- ───────────────────────── Hall of Fame (retired) ─────────────────────────
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

-- ───────────────────────── Auctions ─────────────────────────
create table if not exists ce_auctions (
  id                      text primary key,
  player_id               text references ce_players(id) on delete cascade,
  seller_club_id          text references ce_clubs(id) on delete set null,
  asking_price            bigint not null,
  current_bid             bigint not null default 0,
  current_bidder_club_id  text references ce_clubs(id) on delete set null,
  closes_on_week          int not null,
  seller_acquired_week    int not null default 0,
  seller_acquired_price   bigint not null default 0,
  status                  text not null default 'open'      -- open|sold|unsold
);
create index if not exists ce_auctions_status_idx on ce_auctions(status);

-- ───────────────────────── Match results (history) ─────────────────────────
create table if not exists ce_match_results (
  id            bigint generated always as identity primary key,
  week          int not null,
  home_club_id  text,
  away_club_id  text,
  home_runs     int, home_wkts int,
  away_runs     int, away_wkts int,
  winner_club_id text,
  margin        text,
  mom_name      text,
  created_at    timestamptz not null default now()
);
create index if not exists ce_match_week_idx on ce_match_results(week);

-- ───────────────────────── World log (event feed) ─────────────────────────
create table if not exists ce_world_log (
  id        bigint generated always as identity primary key,
  week      int not null,
  type      text not null,
  club_id   text,
  message   text not null,
  created_at timestamptz not null default now()
);
create index if not exists ce_log_week_idx on ce_world_log(week);

-- ───────────────────────── Row Level Security ─────────────────────────
-- Read-only public access to game state; writes happen via the service-role
-- key on the server (tick) only. Tighten further before public launch.
alter table ce_clubs        enable row level security;
alter table ce_players      enable row level security;
alter table ce_leagues      enable row level security;
alter table ce_auctions     enable row level security;
alter table ce_match_results enable row level security;
alter table ce_world_log    enable row level security;
alter table ce_world        enable row level security;

do $$
begin
  -- public read policies
  perform 1;
  create policy ce_public_read_clubs   on ce_clubs        for select using (true);
  create policy ce_public_read_players on ce_players      for select using (true);
  create policy ce_public_read_leagues on ce_leagues      for select using (true);
  create policy ce_public_read_auct    on ce_auctions     for select using (true);
  create policy ce_public_read_matches on ce_match_results for select using (true);
  create policy ce_public_read_log     on ce_world_log    for select using (true);
  create policy ce_public_read_world   on ce_world        for select using (true);
exception when duplicate_object then null;
end $$;
