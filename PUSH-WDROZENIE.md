# Powiadomienia push — wdrożenie

Ta paczka przywraca push. Nie uruchamiaj `supabase-push-disable.sql` i nie stosuj starej instrukcji PUSH-DISABLE.md.

## 1. Przygotuj Supabase

Wymagana jest obecna konfiguracja kont i ról (`supabase-access.sql`) oraz powiązany administrator. Uruchom `supabase-push-enable.sql` w SQL Editor. Powstaną subskrypcje urządzeń, kolejka i trigger dla nowych powiadomień.

Jeżeli pozostały tabele ze starego, innego wdrożenia push, najpierw wykonaj `supabase-push-disable.sql`, potem nowy skrypt enable. Stary skrypt usuwa jedynie konfigurację push i urządzenia; użytkownicy muszą ponownie włączyć push. Nie usuwa zgłoszeń ani powiadomień wewnętrznych. Nie wykonuj go po nowym wdrożeniu.

## 2. Klucze i funkcja

Lokalnie, mając Node.js, wykonaj:

```sh
node generate-push-keys.mjs
```

W Supabase → Edge Functions → Secrets dodaj wygenerowane `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_WEBHOOK_TOKEN` oraz `VAPID_SUBJECT`, np. `mailto:it@twoja-firma.pl`. Klucze generuj raz i zachowaj. Zmiana pary VAPID wymaga ponownego włączenia push na urządzeniach.

Wdróż funkcję `send-push` z pliku `supabase/functions/send-push/index.js`. Plik jest JavaScript i używa importów npm. Jeśli edytor wymaga index.ts, możesz wkleić tę samą zawartość do index.ts. Wyłącz sprawdzanie JWT dla funkcji — POST chroniony jest osobnym nagłówkiem `x-push-token`, a publiczny GET zwraca tylko publiczny klucz VAPID. Funkcja korzysta z automatycznych zmiennych serwerowych `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY`.

Alternatywa przez CLI, z katalogu paczki:

```sh
supabase functions deploy send-push --project-ref TWOJ_PROJEKT --no-verify-jwt
```

Nie umieszczaj klucza prywatnego, webhook tokenu, service_role ani wypełnionej konfiguracji sekretów w plikach strony lub na GitHub.

## 3. Wysyłka i ponowienia

W Supabase → Database → Webhooks utwórz webhook dla tabeli `public.usterki_push_jobs`, zdarzenie **INSERT**, metoda POST, adres `https://TWOJ_PROJEKT.supabase.co/functions/v1/send-push`. Jeśli dostępne jest pole timeout, ustaw 60000 ms.

Nagłówki:
- `Content-Type`: `application/json`
- `x-push-token`: identyczny `PUSH_WEBHOOK_TOKEN` jak w sekretach funkcji.

Następnie w `supabase-push-scheduler.sql` wpisz URL funkcji i ten sam token, po czym uruchom w SQL Editor. Scheduler co minutę przetwarza zaległe wpisy i ponowienia. Sekrety przechowuje Supabase Vault. Szablon bez wpisanych sekretów można zachować w repozytorium; pliku z wpisanym tokenem nie publikuj.

Funkcja pobiera do 5 zadań w jednym wywołaniu. Kolejka ogranicza współbieżne wysyłki, próbuje maksymalnie 5 razy i usuwa urządzenia odrzucane kodem 404/410. Dostarczenie odbywa się co najmniej raz; identyczny tag ogranicza podwójne widoczne alerty po awarii. Przy dużej kolejce wysyłka może się opóźnić. Nieprzetworzone wpisy są widoczne w `usterki_push_jobs`; `failed` wymaga sprawdzenia konfiguracji i ewentualnego ręcznego wznowienia.

## 4. Pliki strony i urządzenia

Na GitHub wgraj pliki aplikacji, szczególnie `index.html`, `app-core.js`, `bootstrap.js`, `account.js`, `push-client.js`, `app-sw.js` i `ui-theme.css`. Nie musisz publikować katalogu `supabase`, plików SQL, generatora kluczy ani instrukcji. Pełna paczka zachowuje dotychczasowe poprawki.

Po odświeżeniu: „Moje konto” → „Powiadomienia na urządzeniu” → „Włącz”. Użytkownik musi wyrazić zgodę; powiadomienia włącza osobno na każdym urządzeniu. Wylogowanie wyłącza subskrypcję tego urządzenia. Administrator w podglądzie testowym otrzymuje powiadomienia własnego konta.

Na iPhonie/iPadzie wymagany jest iOS/iPadOS 16.4 lub nowszy: Safari → Udostępnij → Dodaj do ekranu początkowego, następnie otwórz aplikację z ikony i włącz powiadomienia. Na komputerze i Androidzie użyj przeglądarki obsługującej Web Push i strony HTTPS. Zgoda, tryb skupienia i ustawienia systemu wpływają na wyświetlanie oraz dźwięk.

## 5. Sprawdzenie po wdrożeniu

Włącz push na koncie administratora, zamknij stronę, a z innego konta dodaj zgłoszenie lub komentarz. Powinien pojawić się alert; kliknięcie prowadzi do zgłoszenia. Sprawdź także wyłączenie push oraz odebranie dostępu profilowi. Autor własnej akcji nie otrzymuje alertu. Powiadomienia trafiają do aktywnych koordynatorów i administratorów, autora zgłoszenia oraz osób z przypisanym MPK. Już przeczytane powiadomienia są pomijane przy wysyłce.

Wysyłka w tle odbywa się w Supabase, nie przez otwartą kartę. Lokalnie sprawdzono logikę na atrapach; prawdziwe dostarczenie wymaga wdrożonej funkcji, kluczy, webhooka i zgody urządzenia.

Obecne ograniczenie: aplikacja nadal ma wspólny rekord JSON. Rozszerzenie sprawdza przypisanie urządzeń i odbiorców, ale nie zastępuje docelowej autoryzacji pojedynczych zgłoszeń po stronie serwera.

Źródła: [Supabase Webhooks](https://supabase.com/docs/guides/database/webhooks), [konfiguracja Edge Functions](https://supabase.com/docs/guides/functions/function-configuration), [WebKit: push na iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [web-push](https://github.com/web-push-libs/web-push).
