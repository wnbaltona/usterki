# Serwis Lokali — zgłoszenia usterek

Wersja pokazowa aplikacji do zgłaszania usterek. Pliki można opublikować razem w jednym katalogu GitHub Pages. `index.html` otwierany lokalnie również korzysta z pozostałych plików tego katalogu.

## Struktura

| Plik | Zawartość |
|---|---|
| `index.html` | Układ strony i kolejność ładowania zasobów |
| `styles.css` | Układ, komponenty i widok mobilny |
| `ui-polish.css` | Jedna paleta kolorów i końcowe wykończenie interfejsu |
| `locations.js` | Katalog lokali i magazynów według MPK |
| `app-config.js` | Publiczny adres i klucz anon projektu Supabase dla dema |
| `model.js` | Reguły danych, statusów i uprawnień |
| `app-core.js` | Stan aplikacji i wspólne funkcje interfejsu |
| `app-views.js` | Widoki zgłoszeń, harmonogramu i administracji |
| `app-actions.js` | Operacje na zgłoszeniach, profilach i plikach |
| `app-events.js` | Obsługa przycisków, formularzy i okien |
| `app-data.js` | Zapis i synchronizacja danych demo przez Supabase |
| `bootstrap.js` | Uruchomienie aplikacji |
| `manifest.json`, ikony, `logo.svg` | Nazwa i grafiki aplikacji |
| `supabase-demo.sql` | Schemat wyłącznie do wspólnego dema |
| `app-sw.js` | Worker aplikacji instalowanej, bez powiadomień push |
| `PUSH-DISABLE.md` | Wyłączenie wcześniej uruchomionej wysyłki push w Supabase |

Przy aktualizacji GitHub Pages trzeba przesłać **cały zestaw zmienionych plików**, nie tylko `index.html`. Wersja produkcyjna wymaga rzeczywistych uprawnień po stronie serwera; obecny przełącznik profili służy prezentacji.

Skrypty w `index.html` są ładowane w podanej kolejności. Aplikacja korzysta ze zwykłych plików JavaScript bez procesu budowania. Kolory podstawowe są zebrane w `:root` na początku `ui-polish.css`; układ pozostaje w `styles.css`.

Powiadomienia widoczne w aplikacji pozostają aktywne. Wysyłka powiadomień push na urządzenia jest wyłączona; jeśli została wcześniej skonfigurowana w Supabase, wykonaj `PUSH-DISABLE.md`.
