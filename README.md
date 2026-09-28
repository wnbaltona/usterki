# Serwis Lokali — zgłoszenia usterek

Wersja pokazowa aplikacji do zgłaszania usterek. Pliki można opublikować razem w jednym katalogu GitHub Pages. Uruchamiaj aplikację przez HTTP lub HTTPS (np. GitHub Pages), aby działał również czytnik PDF.

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

## Usprawnienia interfejsu

- Termin planowany jest główną datą; termin sugerowany pozostaje informacją pomocniczą.
- Aktywne filtry można usuwać osobno. Powrót do listy zachowuje filtry i przewinięcie w bieżącej sesji; zmiana profilu je resetuje.
- Zdjęcia i PDF otwierają się w osobnym podglądzie. Czytnik PDF ma przyciski zmiany stron i działa z lokalnymi plikami z folderu vendor/pdfjs (PDF.js, licencja Apache 2.0).
- Postęp naprawy wyróżnia aktualny etap i rzeczywisty status zgłoszenia.
- Końcowe reguły układu są zebrane w ui-layout.css, ładowanym po ui-polish.css. Publikuj również ten plik i cały folder vendor.
