# Powiadomienia na telefonie — uruchomienie dema

Ta instrukcja dotyczy obecnej wersji pokazowej GitHub Pages + Supabase. Powiadomienia w aplikacji nadal działają bez tej konfiguracji. Powiadomienia systemowe wymagają osobnej zgody na każdym telefonie lub komputerze.

## 1. Dodaj tabelę i kolejkę w Supabase

W projekcie Supabase otwórz **SQL Editor**, wklej całą zawartość `supabase-push.sql` i uruchom. Projekt musi już mieć tabelę z `supabase-demo.sql`.

## 2. Utwórz klucze powiadomień

Jednorazowo wygeneruj parę kluczy VAPID, np. poleceniem `npx web-push generate-vapid-keys`. Zachowaj klucz publiczny i prywatny. **Prywatnego klucza nie wstawiaj do plików na GitHubie.**

W Supabase przejdź do **Edge Functions → Secrets** i dodaj:

| Nazwa | Wartość |
|---|---|
| `VAPID_PUBLIC_KEY` | wygenerowany klucz publiczny |
| `VAPID_PRIVATE_KEY` | wygenerowany klucz prywatny |
| `VAPID_SUBJECT` | adres e-mail w formie `mailto:twoj-adres@firma.pl` |
| `PUSH_WEBHOOK_TOKEN` | własny długi losowy ciąg znaków; ten sam ustaw w webhooku |

Nie zmieniaj tej pary kluczy po zapisaniu urządzeń, bo wcześniejsze zgody przestaną działać. `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` są dostępne dla funkcji Supabase po stronie serwera. Klucza serwisowego nie umieszczaj w aplikacji ani repozytorium.

## 3. Wdróż funkcję wysyłającą

Z katalogu aplikacji użyj Supabase CLI:

```text
supabase login
supabase link --project-ref uwavvvcacsxqkitmfank
supabase functions deploy send-push --no-verify-jwt
```

Funkcja `supabase/functions/send-push/index.ts` zwraca przeglądarce wyłącznie publiczny klucz VAPID. Żądania wysyłające powiadomienia wymagają nagłówka `x-push-token` z wartością `PUSH_WEBHOOK_TOKEN`.

## 4. Połącz kolejkę z funkcją

W Supabase przejdź do **Database → Webhooks** i utwórz webhook:

- tabela: `public.usterki_push_jobs`
- zdarzenie: `INSERT`
- metoda: `POST`
- adres: `https://uwavvvcacsxqkitmfank.supabase.co/functions/v1/send-push`
- własny nagłówek: `x-push-token` = dokładnie ta sama wartość co `PUSH_WEBHOOK_TOKEN`

Zapisz webhook. Nowe powiadomienie w danych dema doda pozycję do kolejki, a webhook wywoła funkcję. Funkcja wysyła na urządzenia zapisane dla danego profilu. Na ekranie blokady pojawia się numer zgłoszenia i ogólna informacja; szczegóły są w aplikacji.

## 5. Opublikuj pliki i włącz na telefonie

Do repozytorium GitHub Pages prześlij zmienione `index.html`, `app.js`, `styles.css` oraz nowe `push-client.js` i `push-sw.js`. Po publikacji otwórz stronę przez **HTTPS**, zaloguj się, otwórz dzwonek **Powiadomienia** i naciśnij **Włącz**. Potwierdź zgodę systemową. Na każdym kolejnym telefonie wykonaj to osobno.

Na iPhonie najpierw dodaj stronę do ekranu początkowego w Safari i otwórz ją z utworzonej ikony. Powiadomienia Web Push działają w aplikacjach dodanych do ekranu początkowego od iOS 16.4. Lokalny adres `file://` nie obsługuje tej funkcji.

## Granice wersji pokazowej

- Każdy tester może przełączyć widok na inny profil. Subskrypcja telefonu podąża za wybranym profilem; nie traktuj tego jako kontroli dostępu.
- Przy wylogowaniu aplikacja usuwa subskrypcję bieżącego urządzenia. Jeśli wylogowanie nastąpi poza aplikacją, przestarzałą subskrypcję można usunąć z tabeli `usterki_push_subscriptions`.
- Nieudane wysyłki zapisują błąd w `usterki_push_jobs.last_error`. Ta wersja nie ma automatycznego ponawiania po awarii funkcji lub webhooka.
- Wersja firmowa powinna wiązać odbiorcę z rzeczywistym kontem, rolą i lokalem po stronie serwera.
