-- Edytuj dwa pola poniżej. Nie publikuj pliku z wpisanym tokenem.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
declare
 function_url text := 'https://TWOJ_PROJEKT.supabase.co/functions/v1/send-push';
 webhook_token text := 'WPISZ_PUSH_WEBHOOK_TOKEN';
 old_job bigint;
begin
 if function_url like '%TWOJ_PROJEKT%' or webhook_token='WPISZ_PUSH_WEBHOOK_TOKEN' then raise exception 'Najpierw wpisz adres funkcji i ten sam PUSH_WEBHOOK_TOKEN co w sekretach Edge Function'; end if;
 if length(webhook_token)<32 then raise exception 'Token musi mieć co najmniej 32 znaki'; end if;
 if exists(select 1 from vault.secrets where name='usterki_push_url') then
 perform vault.update_secret((select id from vault.secrets where name='usterki_push_url'),function_url,'usterki_push_url');
 else perform vault.create_secret(function_url,'usterki_push_url');end if;
 if exists(select 1 from vault.secrets where name='usterki_push_token') then
 perform vault.update_secret((select id from vault.secrets where name='usterki_push_token'),webhook_token,'usterki_push_token');
 else perform vault.create_secret(webhook_token,'usterki_push_token');end if;
 for old_job in select jobid from cron.job where jobname='usterki-push-retry' loop perform cron.unschedule(old_job);end loop;
 perform cron.schedule('usterki-push-retry','* * * * *',$cron$
 select net.http_post(
 url := (select decrypted_secret from vault.decrypted_secrets where name='usterki_push_url'),
 headers := jsonb_build_object('Content-Type','application/json','x-push-token',(select decrypted_secret from vault.decrypted_secrets where name='usterki_push_token')),
 body := '{}'::jsonb, timeout_milliseconds := 60000
 );
 $cron$);
end $$;
