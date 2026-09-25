# Serwis Lokali — zgłoszenia usterek

Wersja pokazowa aplikacji do zgłaszania usterek. Pliki można opublikować razem w jednym katalogu GitHub Pages. `index.html` otwierany lokalnie również korzysta z pozostałych plików tego katalogu.

## Struktura

| Plik | Zawartość |
|---|---|
| `index.html` | Układ strony i kolejność ładowania zasobów |
| `styles.css` | Kolory, układ i wersja mobilna |
| `ui-polish.css` | Końcowa, spójna warstwa wizualna dla komputera i telefonu |
| `locations.js` | Katalog lokali i magazynów według MPK |
| `app.js` | Reguły zgłoszeń, formularze, widoki i obsługa przycisków |
| `cloud-sync.js` | Pokazowy zapis i synchronizacja przez Supabase |
| `bootstrap.js` | Uruchomienie aplikacji |
| `manifest.json`, ikony, `logo.svg` | Nazwa i grafiki aplikacji |
| `supabase-demo.sql` | Schemat wyłącznie do wspólnego dema |
| `push-client.js`, `push-sw.js` | Zgoda na powiadomienia telefonu i wyświetlanie komunikatów systemowych |
| `supabase-push.sql`, `supabase/functions/send-push/` | Kolejka i wysyłka Web Push w Supabase |
| `PUSH-SETUP.md` | Instrukcja włączenia powiadomień |

Przy aktualizacji GitHub Pages trzeba przesłać **cały zestaw zmienionych plików**, nie tylko `index.html`. Wersja produkcyjna wymaga rzeczywistych uprawnień po stronie serwera; obecny przełącznik profili służy prezentacji.

Powiadomienia systemowe nie uruchomią się samą aktualizacją GitHub Pages. Wymagają konfiguracji opisanej w `PUSH-SETUP.md` oraz zgody na każdym urządzeniu.
