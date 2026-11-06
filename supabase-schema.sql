-- ==============================================================================
-- KIKAR AI - SUPABASE DATABASE SCHEMA & POLICIES
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- to initialize all required tables, triggers, real-time publications, and storage.

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  is_online boolean default false,
  last_seen timestamptz default now(),
  push_token text,
  created_at timestamptz default now()
);

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
  created_at timestamptz default now()
);

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

-- 5. DIRECT MESSAGES TABLE
create table if not exists public.direct_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.messages enable row level security;
alter table public.conversations enable row level security;
alter table public.direct_messages enable row level security;

-- Profiles Policies
create policy "Anyone authenticated can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Characters Policies
create policy "Users can view public bots or their own bots"
  on public.characters for select
  to authenticated
  using (is_public = true or created_by = auth.uid());

create policy "Users can insert their own bots"
  on public.characters for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Users can update their own bots"
  on public.characters for update
  to authenticated
  using (created_by = auth.uid());

create policy "Users can delete their own bots"
  on public.characters for delete
  to authenticated
  using (created_by = auth.uid());

-- Messages Policies
create policy "Users can view their own AI messages"
  on public.messages for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own AI messages"
  on public.messages for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can delete their own AI messages"
  on public.messages for delete
  to authenticated
  using (user_id = auth.uid());

-- Conversations Policies
create policy "Users can view conversations they participate in"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user1_id or auth.uid() = user2_id);

create policy "Users can create conversations they participate in"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = user1_id or auth.uid() = user2_id);

-- Direct Messages Policies
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

create policy "Users can send DMs in their conversations"
  on public.direct_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

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

create policy "Senders can delete their own DMs"
  on public.direct_messages for delete
  to authenticated
  using (sender_id = auth.uid());

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url, bio, is_online, last_seen)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    '',
    true,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if already exists and recreate
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

create policy "Public Access for chat-images"
  on storage.objects for select
  to public
  using (bucket_id = 'chat-images');

create policy "Authenticated users can upload chat-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- ==============================================================================

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.direct_messages;
