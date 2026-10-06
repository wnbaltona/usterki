-- Wymaga wdrożonego supabase-access.sql. Uruchom w SQL Editor.
begin;
create table if not exists public.usterki_push_subscriptions (
 endpoint text primary key,
 auth_user_id uuid not null references auth.users(id) on delete cascade,
 profile_id text not null,
 p256dh text not null,
 auth text not null,
 updated_at timestamptz not null default now(),
 check(length(endpoint)<4096 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'),
 check(length(p256dh) between 80 and 120 and length(auth) between 16 and 64)
);
alter table public.usterki_push_subscriptions enable row level security;
revoke all on public.usterki_push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.usterki_push_subscriptions to authenticated;
drop policy if exists own_push_devices on public.usterki_push_subscriptions;
create policy own_push_devices on public.usterki_push_subscriptions to authenticated
 using(auth_user_id=auth.uid())
 with check(auth_user_id=auth.uid() and public.usterki_has_access() and exists(
 select 1 from public.usterki_demo_state s,jsonb_array_elements(s.data->'users') u
 where u->>'id'=profile_id and u->>'authUserId'=auth.uid()::text and u->>'active'='true' and coalesce(u->>'deletedAt','')=''));

create table if not exists public.usterki_push_jobs (
 id uuid primary key default gen_random_uuid(),
 notification_id text not null,
 endpoint text not null references public.usterki_push_subscriptions(endpoint) on delete cascade,
 recipient_id text not null,
 payload jsonb not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz,
 lease_token uuid,
 last_error text,
 created_at timestamptz not null default now(),
 unique(notification_id,endpoint)
);
alter table public.usterki_push_jobs enable row level security;
revoke all on public.usterki_push_jobs from anon,authenticated;
grant all on public.usterki_push_jobs to service_role;
create index if not exists usterki_push_pending on public.usterki_push_jobs(status,next_attempt_at);

create or replace function public.queue_usterki_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.usterki_push_jobs(notification_id,endpoint,recipient_id,payload)
 select n->>'id',d.endpoint,u->>'id',jsonb_build_object('title',left(n->>'title',160),'body',left(n->>'body',500),'ticketId',n->>'ticketId','tag',n->>'id')
 from jsonb_array_elements(coalesce(new.data->'notifications','[]'::jsonb)) n
 join public.usterki_push_subscriptions d on d.profile_id=n->>'recipientId'
 join lateral jsonb_array_elements(new.data->'users') u on u->>'id'=d.profile_id and u->>'authUserId'=d.auth_user_id::text
 join lateral jsonb_array_elements(new.data->'tickets') t on t->>'id'=n->>'ticketId'
 where u->>'active'='true' and coalesce(u->>'deletedAt','')=''
 and n->>'type' in ('new','comment','update') and coalesce(n->>'readAt','')=''
 and (u->>'role' in ('Administrator','Koordynator') or t->>'creatorId'=u->>'id' or coalesce(u->'mpks','[]'::jsonb) ? (t->>'mpk'))
 and exists(select 1 from jsonb_array_elements(new.data->'users') actor where actor->>'id'=n->>'actorId' and actor->>'authUserId'=auth.uid()::text)
 and not exists(select 1 from jsonb_array_elements(coalesce(old.data->'notifications','[]'::jsonb)) prev where prev->>'id'=n->>'id')
 on conflict(notification_id,endpoint) do nothing;
 return new;
end; $$;
revoke all on function public.queue_usterki_push() from public;
drop trigger if exists usterki_push_after_update on public.usterki_demo_state;
create trigger usterki_push_after_update after update on public.usterki_demo_state for each row execute function public.queue_usterki_push();

create or replace function public.claim_usterki_push_jobs() returns setof public.usterki_push_jobs
language plpgsql security definer set search_path='' as $$
begin
 update public.usterki_push_jobs set status='failed',lease_until=null,last_error='Przekroczono limit prób po przerwaniu wysyłki'
 where status='processing' and lease_until<now() and attempts>=5;
 return query
 update public.usterki_push_jobs j set status='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid()
 where j.id in (select id from public.usterki_push_jobs where attempts<5 and ((status='pending' and next_attempt_at<=now()) or (status='processing' and lease_until<now())) order by created_at for update skip locked limit 5)
 returning j.*;
end;
$$;
revoke all on function public.claim_usterki_push_jobs() from public,anon,authenticated;
grant execute on function public.claim_usterki_push_jobs() to service_role;
commit;
