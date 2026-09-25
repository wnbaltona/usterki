-- Wyłącza wyłącznie demonstracyjną wysyłkę Web Push.
-- Zachowuje usterki_demo_state i powiadomienia w aplikacji.
do $$
begin
  if to_regclass('public.usterki_demo_state') is not null then
    execute 'drop trigger if exists usterki_push_after_update on public.usterki_demo_state';
  end if;
end;
$$;

drop function if exists public.queue_usterki_push();
drop function if exists public.claim_usterki_push_job(text);
drop table if exists public.usterki_push_jobs;
drop table if exists public.usterki_push_subscriptions;
