-- Uruchom po supabase-demo.sql, wyłącznie w projekcie pokazowym.
-- Użytkownik zapisuje tylko własną subskrypcję urządzenia.
create table if not exists public.usterki_push_subscriptions (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  endpoint text not null unique check (length(endpoint) <= 2048 and endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists usterki_push_subscriptions_profile_idx
  on public.usterki_push_subscriptions (profile_id);
alter table public.usterki_push_subscriptions enable row level security;
revoke all on public.usterki_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.usterki_push_subscriptions to authenticated;
grant usage, select on sequence public.usterki_push_subscriptions_id_seq to authenticated;

drop policy if exists "push_read_own_device" on public.usterki_push_subscriptions;
create policy "push_read_own_device" on public.usterki_push_subscriptions
  for select to authenticated using (auth_user_id = (select auth.uid()));
drop policy if exists "push_add_own_device" on public.usterki_push_subscriptions;
create policy "push_add_own_device" on public.usterki_push_subscriptions
  for insert to authenticated with check (auth_user_id = (select auth.uid()));
drop policy if exists "push_update_own_device" on public.usterki_push_subscriptions;
create policy "push_update_own_device" on public.usterki_push_subscriptions
  for update to authenticated using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));
drop policy if exists "push_delete_own_device" on public.usterki_push_subscriptions;
create policy "push_delete_own_device" on public.usterki_push_subscriptions
  for delete to authenticated using (auth_user_id = (select auth.uid()));

-- Kolejka powstaje przy każdej nowej pozycji w tablicy powiadomień demo.
-- Z przeglądarki nie da się odczytać ani zmienić tej tabeli.
create table if not exists public.usterki_push_jobs (
  notification_id text primary key,
  recipient_profile_id text not null,
  ticket_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text
);
alter table public.usterki_push_jobs enable row level security;
revoke all on public.usterki_push_jobs from anon, authenticated;

create or replace function public.queue_usterki_push()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.usterki_push_jobs
    (notification_id, recipient_profile_id, ticket_id, title)
  select notification->>'id', notification->>'recipientId',
         notification->>'ticketId', left(notification->>'title', 180)
  from jsonb_array_elements(coalesce(new.data->'notifications', '[]'::jsonb)) as notification
  where notification ? 'id'
    and notification ? 'recipientId'
    and notification ? 'ticketId'
    and notification ? 'title'
    and not exists (
      select 1 from jsonb_array_elements(coalesce(old.data->'notifications', '[]'::jsonb)) as previous
      where previous->>'id' = notification->>'id'
    )
  on conflict (notification_id) do nothing;
  return new;
end;
$$;
revoke all on function public.queue_usterki_push() from public, anon, authenticated;
drop trigger if exists usterki_push_after_update on public.usterki_demo_state;
create trigger usterki_push_after_update
after update of data on public.usterki_demo_state
for each row execute function public.queue_usterki_push();

-- Claim chroni przed powtórną wysyłką przy równoległych webhookach.
create or replace function public.claim_usterki_push_job(job_id text)
returns setof public.usterki_push_jobs language sql security definer
set search_path = public, pg_temp as $$
  update public.usterki_push_jobs
  set claimed_at = now(), last_error = null
  where notification_id = job_id and sent_at is null
    and (claimed_at is null or claimed_at < now() - interval '5 minutes')
  returning *;
$$;
revoke all on function public.claim_usterki_push_job(text) from public, anon, authenticated;
grant execute on function public.claim_usterki_push_job(text) to service_role;
