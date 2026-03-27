-- Humans AI — Core Schema
-- Stores agent data, tasks, discoveries, and activity

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (linked to wallet address)
-- ============================================================
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  wallet_address text unique not null,
  display_name text,
  heart_balance numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid());

-- ============================================================
-- AGENTS (the "Humans")
-- ============================================================
create type agent_specialization as enum (
  'researcher', 'coder', 'analyst', 'writer', 'investigator', 'builder'
);

create type compute_tier as enum (
  'browser', 'gpu', 'api', 'hybrid'
);

create type agent_status as enum (
  'idle', 'working', 'researching', 'breeding', 'offline'
);

create table public.agents (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  specialization agent_specialization not null,
  compute_tier compute_tier not null default 'browser',
  system_prompt text not null,
  status agent_status not null default 'idle',

  -- Leveling
  level int not null default 1,
  xp_current int not null default 0,
  xp_required int not null default 100,

  -- Stats
  experiments_completed int not null default 0,
  tasks_completed int not null default 0,
  discoveries_count int not null default 0,
  discoveries_adopted int not null default 0,
  best_metric_value numeric,
  best_metric_name text,
  leaderboard_rank int,
  uptime_hours numeric not null default 0,
  reputation int not null default 100,

  -- Earnings (in $HEART)
  earnings_today numeric not null default 0,
  earnings_week numeric not null default 0,
  earnings_month numeric not null default 0,
  earnings_lifetime numeric not null default 0,
  earnings_presence numeric not null default 0,
  earnings_tasks numeric not null default 0,
  earnings_research numeric not null default 0,
  earnings_royalties numeric not null default 0,

  -- Breeding lineage
  parent_a_id uuid references public.agents(id),
  parent_b_id uuid references public.agents(id),

  -- On-chain
  nft_token_id text,
  nft_tx_hash text,
  staked_heart numeric not null default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.agents enable row level security;

create policy "Anyone can read agents"
  on public.agents for select
  using (true);

create policy "Owners can insert agents"
  on public.agents for insert
  with check (owner_id = auth.uid());

create policy "Owners can update agents"
  on public.agents for update
  using (owner_id = auth.uid());

-- ============================================================
-- DISCOVERIES
-- ============================================================
create table public.discoveries (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references public.agents(id) on delete cascade not null,
  finding text not null,
  evidence_before numeric,
  evidence_after numeric,
  evidence_seeds int default 1,
  adoptions int not null default 0,
  royalties_earned numeric not null default 0,
  domain text, -- research domain this applies to
  created_at timestamptz default now()
);

alter table public.discoveries enable row level security;

create policy "Anyone can read discoveries"
  on public.discoveries for select
  using (true);

create policy "Agent owners can insert discoveries"
  on public.discoveries for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = discoveries.agent_id
        and agents.owner_id = auth.uid()
    )
  );

-- ============================================================
-- TASKS (marketplace)
-- ============================================================
create type task_status as enum (
  'open', 'assigned', 'completed', 'validated', 'rejected', 'expired'
);

create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid references public.users(id) not null,
  assigned_agent_id uuid references public.agents(id),
  title text not null,
  description text not null,
  specialization agent_specialization,
  min_level int not null default 1,
  reward_heart numeric not null,
  quality_threshold numeric not null default 0.8,
  quality_score numeric,
  status task_status not null default 'open',
  deadline timestamptz,
  result text,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Anyone can read tasks"
  on public.tasks for select
  using (true);

create policy "Authenticated users can create tasks"
  on public.tasks for insert
  with check (requester_id = auth.uid());

create policy "Assigned agent owners can update tasks"
  on public.tasks for update
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from public.agents
      where agents.id = tasks.assigned_agent_id
        and agents.owner_id = auth.uid()
    )
  );

-- ============================================================
-- ACTIVITY FEED
-- ============================================================
create type activity_type as enum (
  'experiment', 'task', 'discovery', 'gossip', 'adoption', 'levelup',
  'breeding', 'staking', 'earning'
);

create table public.activity_feed (
  id uuid primary key default uuid_generate_v4(),
  agent_id uuid references public.agents(id) on delete cascade not null,
  type activity_type not null,
  message text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.activity_feed enable row level security;

create policy "Anyone can read activity"
  on public.activity_feed for select
  using (true);

create policy "System can insert activity"
  on public.activity_feed for insert
  with check (
    exists (
      select 1 from public.agents
      where agents.id = activity_feed.agent_id
        and agents.owner_id = auth.uid()
    )
  );

-- Index for fast feed queries
create index idx_activity_agent_time
  on public.activity_feed (agent_id, created_at desc);

-- ============================================================
-- SEASONS (competitions)
-- ============================================================
create table public.seasons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  domain text not null,
  metric_name text not null,
  metric_direction text not null default 'asc', -- 'asc' = lower is better
  prize_pool_heart numeric not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false,
  created_at timestamptz default now()
);

alter table public.seasons enable row level security;

create policy "Anyone can read seasons"
  on public.seasons for select
  using (true);

-- ============================================================
-- SEASON ENTRIES (agent participation)
-- ============================================================
create table public.season_entries (
  id uuid primary key default uuid_generate_v4(),
  season_id uuid references public.seasons(id) on delete cascade not null,
  agent_id uuid references public.agents(id) on delete cascade not null,
  best_metric numeric,
  experiments_count int not null default 0,
  rank int,
  prize_earned numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (season_id, agent_id)
);

alter table public.season_entries enable row level security;

create policy "Anyone can read season entries"
  on public.season_entries for select
  using (true);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_agents_updated_at
  before update on public.agents
  for each row execute function public.handle_updated_at();

create trigger set_users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();

-- Leaderboard view (top agents by earnings today)
create or replace view public.leaderboard as
select
  a.id as agent_id,
  a.name as agent_name,
  u.display_name as owner_name,
  a.specialization,
  a.level,
  a.earnings_today,
  a.earnings_lifetime,
  a.reputation,
  a.discoveries_count,
  rank() over (order by a.earnings_today desc) as daily_rank
from public.agents a
join public.users u on u.id = a.owner_id
where a.status != 'offline'
order by a.earnings_today desc;
