-- ==============================================================================
-- KIKAR v5 SECURITY MIGRATION  (PostgreSQL / Supabase)
-- Run AFTER supabase-schema.sql, in the Supabase SQL Editor, BEFORE deploying v5 code.
-- Safe to run more than once.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Users can never change their own plan_tier from the browser.
--    Only the service role (billing webhook / checkout route) or the SQL editor can.
-- ------------------------------------------------------------------------------
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.plan_tier := 'free';
    else
      new.plan_tier := old.plan_tier;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_plan on public.profiles;
create trigger protect_profile_plan
  before insert or update on public.profiles
  for each row execute function public.protect_profile_plan();

-- ------------------------------------------------------------------------------
-- 2. Quotas become server-only: clients can read their row but not write it.
-- ------------------------------------------------------------------------------
drop policy if exists "Users can update their own usage quotas" on public.usage_quotas;
drop policy if exists "Users can increment their own usage quotas" on public.usage_quotas;

revoke insert, update, delete on public.usage_quotas from anon, authenticated;
revoke insert, update, delete on public.subscriptions from anon, authenticated;

alter table public.usage_quotas
  add column if not exists last_monthly_reset date default (date_trunc('month', current_date))::date;

-- Default limits per plan (must match src/lib/plans.js)
create or replace function public.plan_defaults(p_tier text)
returns table (chat_limit integer, image_limit integer)
language sql
immutable
as $$
  select
    case p_tier when 'pro' then 999999 when 'plus' then 500 else 30 end,
    case p_tier when 'pro' then 250    when 'plus' then 50  else 3  end;
$$;

-- Atomically consumes one AI chat. Resets the daily counter on a new day.
create or replace function public.consume_chat_quota(p_user uuid)
returns table (allowed boolean, used integer, quota_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_chat integer;
  v_img integer;
  r record;
begin
  select coalesce(plan_tier, 'free') into v_tier from public.profiles where id = p_user;
  if not found then
    return query select false, 0, 0;
    return;
  end if;

  select d.chat_limit, d.image_limit into v_chat, v_img from public.plan_defaults(v_tier) d;

  insert into public.usage_quotas (user_id, daily_chat_limit, monthly_image_limit)
  values (p_user, v_chat, v_img)
  on conflict (user_id) do nothing;

  update public.usage_quotas q
     set daily_chat_used = 0, last_daily_reset = current_date, updated_at = now()
   where q.user_id = p_user
     and coalesce(q.last_daily_reset, date '1970-01-01') < current_date;

  update public.usage_quotas q
     set daily_chat_used = q.daily_chat_used + 1, updated_at = now()
   where q.user_id = p_user and q.daily_chat_used < q.daily_chat_limit
  returning q.daily_chat_used, q.daily_chat_limit into r;

  if found then
    return query select true, r.daily_chat_used, r.daily_chat_limit;
  else
    select q.daily_chat_used, q.daily_chat_limit into r
      from public.usage_quotas q where q.user_id = p_user;
    return query select false, r.daily_chat_used, r.daily_chat_limit;
  end if;
end;
$$;

-- Atomically consumes one AI image. Resets the monthly counter on a new month.
create or replace function public.consume_image_quota(p_user uuid)
returns table (allowed boolean, used integer, quota_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_chat integer;
  v_img integer;
  r record;
begin
  select coalesce(plan_tier, 'free') into v_tier from public.profiles where id = p_user;
  if not found then
    return query select false, 0, 0;
    return;
  end if;

  select d.chat_limit, d.image_limit into v_chat, v_img from public.plan_defaults(v_tier) d;

  insert into public.usage_quotas (user_id, daily_chat_limit, monthly_image_limit)
  values (p_user, v_chat, v_img)
  on conflict (user_id) do nothing;

  update public.usage_quotas q
     set monthly_image_used = 0,
         last_monthly_reset = (date_trunc('month', current_date))::date,
         updated_at = now()
   where q.user_id = p_user
     and coalesce(q.last_monthly_reset, date '1970-01-01') < (date_trunc('month', current_date))::date;

  update public.usage_quotas q
     set monthly_image_used = q.monthly_image_used + 1, updated_at = now()
   where q.user_id = p_user and q.monthly_image_used < q.monthly_image_limit
  returning q.monthly_image_used, q.monthly_image_limit into r;

  if found then
    return query select true, r.monthly_image_used, r.monthly_image_limit;
  else
    select q.monthly_image_used, q.monthly_image_limit into r
      from public.usage_quotas q where q.user_id = p_user;
    return query select false, r.monthly_image_used, r.monthly_image_limit;
  end if;
end;
$$;

-- Give the credit back when the AI provider fails, so users are not charged for errors.
create or replace function public.refund_chat_quota(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.usage_quotas
     set daily_chat_used = greatest(daily_chat_used - 1, 0), updated_at = now()
   where user_id = p_user;
$$;

create or replace function public.refund_image_quota(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.usage_quotas
     set monthly_image_used = greatest(monthly_image_used - 1, 0), updated_at = now()
   where user_id = p_user;
$$;

-- Only the server (service role) may call these.
revoke all on function public.consume_chat_quota(uuid)  from public, anon, authenticated;
revoke all on function public.consume_image_quota(uuid) from public, anon, authenticated;
revoke all on function public.refund_chat_quota(uuid)   from public, anon, authenticated;
revoke all on function public.refund_image_quota(uuid)  from public, anon, authenticated;
grant execute on function public.consume_chat_quota(uuid)  to service_role;
grant execute on function public.consume_image_quota(uuid) to service_role;
grant execute on function public.refund_chat_quota(uuid)   to service_role;
grant execute on function public.refund_image_quota(uuid)  to service_role;

-- ------------------------------------------------------------------------------
-- 3. Storage: uploads only into your own folder (<user-id>/<file>), images only, 5 MB max.
--    The bucket stays public, so image URLs keep working; the broad SELECT policy is dropped
--    so nobody can list every file in the bucket.
-- ------------------------------------------------------------------------------
drop policy if exists "Public Access for chat-images" on storage.objects;
drop policy if exists "Authenticated users can upload chat-images" on storage.objects;
drop policy if exists "Users upload to their own chat-images folder" on storage.objects;

create policy "Users upload to their own chat-images folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
 where id = 'chat-images';
