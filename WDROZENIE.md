# Nadawanie dostępu kontom Supabase

1. Zrób kopię rekordu `usterki_demo_state` w Supabase. Zachowaj dotychczasowe pliki hostingu.
2. Baza musi już zawierać dane aplikacji (`data.users`). Dla pustego projektu uruchom dotychczasową aplikację, aby zainicjowała dane, przed instalacją tego rozszerzenia.
3. Utwórz własne konto w Authentication → Users. W SQL Editor wykonaj poniższy kod, zastępując adres swoim adresem. Kod przypisuje istniejący profil administratora do konta, zachowując identyfikator profilu i historię. Sprawdź wynik SELECT.

```sql
do $$
declare account_id uuid; account_email text; profile_id text;
begin
 select id,email into account_id,account_email from auth.users where lower(email)=lower('TWOJ_EMAIL@FIRMA.PL');
 if account_id is null then raise exception 'Najpierw utwórz konto w Authentication'; end if;
 select p->>'id' into profile_id from public.usterki_demo_state s, jsonb_array_elements(s.data->'users') p
 where p->>'role'='Administrator' and p->>'active'='true' and coalesce(p->>'deletedAt','')='' limit 1;
 if profile_id is null then raise exception 'Brak profilu administratora w istniejących danych'; end if;
 update public.usterki_demo_state s set data=jsonb_set(s.data,'{users}',
 (select jsonb_agg(case when p->>'id'=profile_id then p||jsonb_build_object('authUserId',account_id::text,'email',lower(account_email),'active',true) else p end)
 from jsonb_array_elements(s.data->'users') p)), revision=revision+1,updated_at=now() where s.id=1;
end $$;
select p from public.usterki_demo_state s,jsonb_array_elements(s.data->'users') p where p ? 'authUserId';
```

4. Uruchom cały `supabase-access.sql` w SQL Editor tego samego projektu. Nie uruchamiaj potem ponownie `supabase-demo.sql`, ponieważ przywraca on stare polityki dostępu.
5. Wgraj pliki aplikacji na dotychczasowy hosting. Odśwież stronę i zaloguj się kontem powiązanym w kroku 3.
6. Twórz kolejne konta w Supabase. W aplikacji otwórz Administracja → Użytkownicy, kliknij „Odśwież konta”, następnie „Nadaj dostęp”. Wybierz rolę, wpisz nazwę i przypisz MPK dla kierownika. Zapisz.
7. Istniejący profil testowy możesz powiązać przez edycję i wpisanie e-maila rzeczywistego konta. Zachowuje to historię zgłoszeń profilu. Jeśli profil był usunięty, najpierw powiąż go przez edycję po przywróceniu z SQL Editor.

Nowe konto bez aktywnego profilu nie pobierze wspólnych danych ani plików. Wyłączenie profilu odbiera dostęp; zmiana roli jest widoczna po synchronizacji lub odświeżeniu strony. Lista kont i zmiany uprawnień wymagają roli administratora także po stronie bazy. Hasła i klucz service_role nie są przekazywane aplikacji.

Weryfikacja po wdrożeniu: nowe konto bez roli nie otwiera zgłoszeń; administrator może nadać mu Koordynatora; koordynator widzi obsługę zgłoszeń, ale nie Administrację; wyłączenie profilu blokuje odczyt/zapis; próba zmiany `data.users` z sesji koordynatora jest odrzucana.

Ograniczenie obecnej architektury: zgłoszenia nadal znajdują się w jednym wspólnym JSON. Aktywne konta mają dostęp do całego rekordu przez API, a filtrowanie zgłoszeń według roli/MPK odbywa się w interfejsie. Ten dodatek chroni nadawanie ról i dostęp kont, ale nie wprowadza serwerowych uprawnień do pojedynczych zgłoszeń.

## Aktualizacja poprawki profili

Jeśli poprzednia wersja kont i ról została już wdrożona, wystarczy podmienić pliki aplikacji z nowej paczki i odświeżyć stronę. SQL pozostaje bez zmian; nie wykonuj ponownie powiązania pierwszego administratora.

Nadawanie dostępu wiąże konto z istniejącym profilem o tym samym e-mailu, także z profilem usuniętym, zachowując identyfikator i historię. Zapis przywraca taki profil. Trwałe usunięcie jest dostępne wyłącznie dla profili z listy usuniętych, wymaga potwierdzenia i usuwa profil oraz jego powiadomienia. Zachowuje zgłoszenia i komentarze oraz konto w Supabase. Po ponownym nadaniu dostępu trwale usuniętemu kontu powstaje nowy profil.
