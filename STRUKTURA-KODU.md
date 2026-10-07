# Struktura kodu

Ta paczka pochodzi z załącznika `usterki-main (3).zip`. Zachowuje Supabase, dotychczasową konfigurację, logowanie oraz powiadomienia. To osobna wersja od paczki dla IT korzystającej z własnych systemów.

## Pliki aplikacji

- `bootstrap.js` uruchamia aplikację.
- `app-core.js` utrzymuje stan interfejsu i wspólne funkcje.
- `views/` zawiera widoki: wspólne elementy, ekran główny, formularz zgłoszenia, lista, harmonogram, dashboard, administracja i szczegóły.
- `app-events.js` obsługuje zdarzenia i formularze.
- `app-actions.js` wykonuje operacje na zgłoszeniach i profilach.
- `app-data.js` odpowiada za dane, sesję oraz synchronizację z Supabase.
- `model.js` zawiera reguły danych i obliczenia.
- `account.js` obsługuje panel konta, a `microsoft-auth.js` logowanie Microsoft.
- `install.js`, `push-client.js`, `app-sw.js` i `push-sw.js` obsługują instalację oraz powiadomienia.
- `supabase/` i pliki SQL zawierają dotychczasowe elementy backendu.
- `legacy/` przechowuje stare, nieładowane implementacje `app.js` i `cloud-sync.js`.

## Zasady utrzymania

Skrypty nadal działają bez kompilacji, w kolejności określonej w `index.html`. Funkcje widoków zachowują dotychczasowe nazwy. JavaScript i CSS mają spójne wcięcia. Dodano `.editorconfig`.

Kolejność arkuszy i ich reguły pozostawiono bez zmian, ponieważ wpływają na kaskadę stylów. Nowe poprawki konkretnego ekranu umieszczaj w jego arkuszu. Nie dodawaj sekretów serwera do plików przeglądarkowych.

## Zakres i weryfikacja

Podzielono `app-views.js` na osiem plików i zaktualizowano ich ładowanie. Formatowanie JavaScript sprawdzono przez porównanie drzew składniowych; CSS przez porównanie kolejności reguł i deklaracji. Konfiguracja, SQL oraz funkcja serwerowa pozostają bez zmian. Testy logiki są w `tests/`.

Nie przebudowywano zabezpieczeń ani schematu bazy. Nie wykonywano wizualnego odbioru wszystkich ekranów w przeglądarce.

## Wgranie aktualizacji

Wgraj cały katalog, w tym nowy folder `views/`. Nie trzeba ponownie wykonywać SQL ani zmieniać ustawień Supabase z powodu tego porządkowania. Foldery `tests/` i `legacy/` oraz dokumentacja nie są potrzebne na hostingu. Zachowaj dotychczasowe instrukcje wdrożenia.
