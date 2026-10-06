-- Uruchom po supabase-demo.sql. Nie uruchamiaj ponownie starego skryptu demo.
-- Pierwszego administratora powiąż ręcznie według instrukcji WDROZENIE.md.
begin;
create or replace function public.usterki_has_access(admin_only boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.usterki_demo_state s,
 jsonb_array_elements(coalesce(s.data->'users','[]'::jsonb)) u
 where u->>'authUserId'=auth.uid()::text and u->>'active'='true'
 and coalesce(u->>'deletedAt','')='' and (not admin_only or u->>'role'='Administrator'));
$$;
revoke all on function public.usterki_has_access(boolean) from public;
grant execute on function public.usterki_has_access(boolean) to authenticated;

create or replace function public.usterki_list_accounts()
returns table(id uuid,email text) language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.usterki_has_access(true) then raise exception 'Tylko administrator może pobrać konta'; end if;
 return query select a.id,a.email::text from auth.users a where a.email is not null order by a.email;
end; $$;
revoke all on function public.usterki_list_accounts() from public;
grant execute on function public.usterki_list_accounts() to authenticated;

create or replace function public.usterki_protect_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare u jsonb; old_u jsonb;
begin
 -- SQL Editor / administrator bazy może wykonać pierwsze powiązanie.
 if auth.uid() is null then return new; end if;
 if new.data->'users' is distinct from old.data->'users' then
  if not public.usterki_has_access(true) then raise exception 'Tylko administrator może zmieniać dostęp'; end if;
  if jsonb_typeof(new.data->'users') is distinct from 'array' then raise exception 'Nieprawidłowa lista profili'; end if;
  for u in select value from jsonb_array_elements(new.data->'users') loop
   select value into old_u from jsonb_array_elements(old.data->'users') where value->>'id'=u->>'id';
   if u is distinct from old_u then
    if coalesce(u->>'authUserId','')<>'' then
     if not exists(select 1 from auth.users a where a.id::text=u->>'authUserId' and lower(a.email)=lower(u->>'email')) then raise exception 'Profil musi wskazywać istniejące konto Supabase z tym e-mailem'; end if;
    elsif coalesce(u->>'deletedAt','')='' then raise exception 'Najpierw powiąż profil z kontem Supabase'; end if;
    if u->>'role' is null or u->>'role' not in ('Użytkownik','Kierownik lokalu','Koordynator','Administrator') then raise exception 'Nieprawidłowa rola'; end if;
    if u->>'role'='Kierownik lokalu' and (jsonb_typeof(u->'mpks') is distinct from 'array' or jsonb_array_length(u->'mpks')=0) then raise exception 'Przypisz MPK kierownikowi'; end if;
   end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(new.data->'users') p where coalesce(p->>'authUserId','')<>'' group by p->>'authUserId' having count(*)>1) then raise exception 'Konto ma już profil'; end if;
  if not exists(select 1 from jsonb_array_elements(new.data->'users') p join auth.users a on a.id::text=p->>'authUserId' where p->>'active'='true' and p->>'role'='Administrator' and coalesce(p->>'deletedAt','')='') then raise exception 'Musi pozostać aktywny administrator'; end if;
 end if;
 if not public.usterki_has_access(true) and (new.data->'settings' is distinct from old.data->'settings' or new.data->'locations' is distinct from old.data->'locations') then raise exception 'Tylko administrator może zmieniać ustawienia i lokale'; end if;
 return new;
end; $$;
revoke all on function public.usterki_protect_access() from public;
drop trigger if exists usterki_protect_access on public.usterki_demo_state;
create trigger usterki_protect_access before update on public.usterki_demo_state for each row execute function public.usterki_protect_access();
drop policy if exists demo_read_for_signed_in_users on public.usterki_demo_state;
drop policy if exists demo_update_for_signed_in_users on public.usterki_demo_state;
create policy demo_read_for_signed_in_users on public.usterki_demo_state for select to authenticated using(public.usterki_has_access());
create policy demo_update_for_signed_in_users on public.usterki_demo_state for update to authenticated using(public.usterki_has_access()) with check(public.usterki_has_access());
drop policy if exists demo_files_read_for_signed_in_users on storage.objects;
drop policy if exists demo_files_upload_for_signed_in_users on storage.objects;
drop policy if exists demo_files_delete_own_uploads on storage.objects;
create policy demo_files_read_for_signed_in_users on storage.objects for select to authenticated using(bucket_id='usterki-demo-files' and public.usterki_has_access());
create policy demo_files_upload_for_signed_in_users on storage.objects for insert to authenticated with check(bucket_id='usterki-demo-files' and public.usterki_has_access());
create policy demo_files_delete_own_uploads on storage.objects for delete to authenticated using(bucket_id='usterki-demo-files' and public.usterki_has_access() and (owner_id=auth.uid()::text or public.usterki_has_access(true)));
commit;
