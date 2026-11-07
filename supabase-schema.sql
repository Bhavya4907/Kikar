-- ==============================================================================
-- KIKAR AI (COMMERCIAL v2 + LIVE CHAT & MOBILE FIX) - SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- to initialize all required tables, realtime replication, triggers, and storage.

-- 1. PROFILES TABLE (Extended with Auto-Replica & Plan Metadata)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  is_online boolean default false,
  last_seen timestamptz default now(),
  push_token text,
  auto_replica_enabled boolean default true,
  replica_status_note text default '',
  plan_tier text default 'free' check (plan_tier in ('free', 'plus', 'pro')),
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists auto_replica_enabled boolean default true;
alter table public.profiles add column if not exists replica_status_note text default '';
alter table public.profiles add column if not exists plan_tier text default 'free';

-- 2. CHARACTERS TABLE (AI Personas & Digital Replicas)
create table if not exists public.characters (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  emoji text not null default '🤖',
  system_prompt text not null,
  created_by uuid references auth.users(id) on delete cascade not null,
  is_public boolean default false,
  is_replica boolean default false,
  replica_of uuid references public.profiles(id) on delete set null,
  category text default 'general',
  chat_count integer default 0,
  created_at timestamptz default now()
);

alter table public.characters add column if not exists category text default 'general';
alter table public.characters add column if not exists chat_count integer default 0;

-- 3. AI MESSAGES TABLE
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  character_id uuid references public.characters(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- 4. CONVERSATIONS TABLE (Direct Messaging Threads)
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references public.profiles(id) on delete cascade not null,
  user2_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now()
);

-- 5. DIRECT MESSAGES TABLE (Extended with AI Replica & Co-Pilot Flags)
create table if not exists public.direct_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  is_replica_reply boolean default false,
  ai_persona_name text,
  created_at timestamptz default now(),
  read_at timestamptz
);

alter table public.direct_messages add column if not exists is_replica_reply boolean default false;
alter table public.direct_messages add column if not exists ai_persona_name text;

-- Enable FULL replica identity so Supabase Realtime broadcasts INSERT/UPDATE/DELETE reliably
alter table public.profiles replica identity full;
alter table public.conversations replica identity full;
alter table public.direct_messages replica identity full;

-- 6. SUBSCRIPTIONS TABLE (Razorpay / Stripe / RevenueCat Entitlements)
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade unique not null,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'plus', 'pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  payment_provider text default 'razorpay' check (payment_provider in ('razorpay', 'stripe', 'revenuecat', 'manual')),
  external_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- 7. USAGE QUOTAS TABLE (Daily AI Chat & Monthly Image Credits)
create table if not exists public.usage_quotas (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  daily_chat_used integer default 0,
  daily_chat_limit integer default 30,
  monthly_image_used integer default 0,
  monthly_image_limit integer default 3,
  last_daily_reset date default current_date,
  updated_at timestamptz default now()
);

-- 8. CHARACTER & MESSAGE REPORTS TABLE (Google Play UGC Safety Compliance)
create table if not exists public.character_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references public.profiles(id) on delete cascade not null,
  character_id uuid references public.characters(id) on delete cascade,
  reason text not null,
  details text,
  status text default 'open' check (status in ('open', 'reviewed', 'resolved')),
  created_at timestamptz default now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_quotas enable row level security;
alter table public.character_reports enable row level security;

-- Profiles Policies
drop policy if exists "Anyone authenticated can view profiles" on public.profiles;
create policy "Anyone authenticated can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Characters Policies
drop policy if exists "Users can view public bots or their own bots" on public.characters;
drop policy if exists "Users can view public bots, own bots, or active replicas" on public.characters;
create policy "Users can view public bots, own bots, or active replicas"
  on public.characters for select
  to authenticated
  using (is_public = true or created_by = auth.uid() or is_replica = true);

drop policy if exists "Users can insert their own bots" on public.characters;
create policy "Users can insert their own bots"
  on public.characters for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Users can update their own bots" on public.characters;
create policy "Users can update their own bots"
  on public.characters for update
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "Users can delete their own bots" on public.characters;
create policy "Users can delete their own bots"
  on public.characters for delete
  to authenticated
  using (created_by = auth.uid());

-- Messages Policies
drop policy if exists "Users can view their own AI messages" on public.messages;
create policy "Users can view their own AI messages"
  on public.messages for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own AI messages" on public.messages;
create policy "Users can insert their own AI messages"
  on public.messages for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own AI messages" on public.messages;
create policy "Users can delete their own AI messages"
  on public.messages for delete
  to authenticated
  using (user_id = auth.uid());

-- Conversations Policies
drop policy if exists "Users can view conversations they participate in" on public.conversations;
create policy "Users can view conversations they participate in"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user1_id or auth.uid() = user2_id);

drop policy if exists "Users can create conversations they participate in" on public.conversations;
create policy "Users can create conversations they participate in"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = user1_id or auth.uid() = user2_id);

-- Direct Messages Policies
drop policy if exists "Users can view DMs in their conversations" on public.direct_messages;
create policy "Users can view DMs in their conversations"
  on public.direct_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

drop policy if exists "Users can send DMs in their conversations" on public.direct_messages;
create policy "Users can send DMs in their conversations"
  on public.direct_messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

drop policy if exists "Participants can update read_at on DMs" on public.direct_messages;
create policy "Participants can update read_at on DMs"
  on public.direct_messages for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

drop policy if exists "Senders can delete their own DMs" on public.direct_messages;
create policy "Senders can delete their own DMs"
  on public.direct_messages for delete
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

-- Subscriptions & Usage Quotas Policies
drop policy if exists "Users can view their own subscription" on public.subscriptions;
create policy "Users can view their own subscription"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can view their own usage quotas" on public.usage_quotas;
create policy "Users can view their own usage quotas"
  on public.usage_quotas for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update their own usage quotas" on public.usage_quotas;
create policy "Users can update their own usage quotas"
  on public.usage_quotas for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can increment their own usage quotas" on public.usage_quotas;
create policy "Users can increment their own usage quotas"
  on public.usage_quotas for update
  to authenticated
  using (user_id = auth.uid());

-- Reports Policies
drop policy if exists "Users can submit safety reports" on public.character_reports;
create policy "Users can submit safety reports"
  on public.character_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- ==============================================================================
-- AUTOMATIC PROFILE & QUOTA CREATION TRIGGER ON AUTH SIGNUP
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url, bio, is_online, last_seen, auto_replica_enabled, plan_tier)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    '',
    true,
    now(),
    true,
    'free'
  )
  on conflict (id) do nothing;

  insert into public.usage_quotas (user_id, daily_chat_used, daily_chat_limit, monthly_image_used, monthly_image_limit)
  values (new.id, 0, 30, 0, 3)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==============================================================================
-- STORAGE BUCKET FOR CHAT IMAGES
-- ==============================================================================

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Access for chat-images" on storage.objects;
create policy "Public Access for chat-images"
  on storage.objects for select
  to public
  using (bucket_id = 'chat-images');

drop policy if exists "Authenticated users can upload chat-images" on storage.objects;
create policy "Authenticated users can upload chat-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS (SAFE IDEMPOTENT ADDITION)
-- ==============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end $$;
