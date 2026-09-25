-- WERSJA POKAZOWA. Uruchom tylko w projekcie Supabase używanym przez aplikację.
-- Wspólne zgłoszenia są dostępne każdemu zalogowanemu kontu testowemu.
-- Nie używaj tutaj prawdziwych danych osobowych ani produkcyjnych zgłoszeń.

create table if not exists public.usterki_demo_state (
  id integer primary key check (id = 1),
  revision bigint not null default 0,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.usterki_demo_state (id, revision, data)
values (1, 0, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.usterki_demo_state enable row level security;
revoke all on public.usterki_demo_state from anon;
grant select, update on public.usterki_demo_state to authenticated;

drop policy if exists "demo_read_for_signed_in_users" on public.usterki_demo_state;
create policy "demo_read_for_signed_in_users"
on public.usterki_demo_state for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "demo_update_for_signed_in_users" on public.usterki_demo_state;
create policy "demo_update_for_signed_in_users"
on public.usterki_demo_state for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

-- Najpierw utwórz w Storage PRYWATNY bucket o nazwie usterki-demo-files.
-- Potem uruchom poniższe polityki (możesz uruchomić cały plik po utworzeniu bucketu).
drop policy if exists "demo_files_read_for_signed_in_users" on storage.objects;
create policy "demo_files_read_for_signed_in_users"
on storage.objects for select to authenticated
using (bucket_id = 'usterki-demo-files');

drop policy if exists "demo_files_upload_for_signed_in_users" on storage.objects;
create policy "demo_files_upload_for_signed_in_users"
on storage.objects for insert to authenticated
with check (bucket_id = 'usterki-demo-files');

drop policy if exists "demo_files_delete_own_uploads" on storage.objects;
create policy "demo_files_delete_own_uploads"
on storage.objects for delete to authenticated
using (bucket_id = 'usterki-demo-files' and owner_id = (select auth.uid()::text));
