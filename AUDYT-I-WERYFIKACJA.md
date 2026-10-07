# Weryfikacja aplikacji — 07.10.2026

## Wniosek

Testy lokalnej logiki i generowania ekranów przeszły. Nie oznacza to potwierdzenia działania całego wdrożenia, zgodności WCAG ani bezpieczeństwa produkcyjnego. Nie wykonywano operacji na prawdziwej bazie, kontach ani urządzeniach użytkowników.

## Zmiany

- Usunięto nieładowane kopie app.js, app-views.js, cloud-sync.js oraz legacy/. Oryginalna paczka pozostaje dostępna osobno.
- Profil administratora nie jest już wybierany awaryjnie przed logowaniem. Brak aktywnej sesji/profilu blokuje zapis i daje bezpieczny wynik w funkcjach uprawnień/listy zgłoszeń.
- Usunięto zbędne wczytywanie starego wyboru profilu podczas uruchamiania.
- Dodano bezpieczną obsługę nieobecnych elementów DOM przy odświeżaniu listy załączników.
- Dodano link do pominięcia nawigacji, widoczny fokus klawiatury, oznaczenia kolumn tabel, poprawioną czytelność tekstów pomocniczych i obsługę ograniczenia animacji.
- Uporządkowano sugerowany termin w wąskiej kolumnie. Zachowano wcześniejsze poprawki tabel i pionowych paneli administracji.
- Długie wartości skrócone w kartach mają pełną treść w atrybucie title oraz w szczegółach zgłoszenia.

Limit 40 kategorii pozostawiono. Test potwierdził, że domyślna lista się w nim mieści; wcześniejsze podejrzenie błędu limitu nie zostało potwierdzone.

## Wykonane sprawdzenia

Osiem zestawów testów: dostęp i nadawanie roli; podgląd trzech ról bez zapisu; warianty logowania Microsoft i callback; dashboard i filtry czasu; powiadomienia workerów; blokada powtórnej operacji; ustawienia i pliki; zapis oraz rollback uploadu przy błędzie i konflikcie wersji. Usługi są atrapami.

Wygenerowano 19 ekranów dla czterech ról bez błędów JavaScript. Sprawdzono składnię wszystkich skryptów, reguły CSS, kompletność lokalnych odwołań i archiwum. Konfiguracja połączenia, SQL i funkcja send-push nie zostały zmienione.

## UX/UI i dostępność

Punktem odniesienia jest [WCAG 2.2 — lista kryteriów W3C](https://www.w3.org/WAI/WCAG22/quickref/): etykiety pól, rozpoznawalne błędy, obsługa klawiaturą, widoczny fokus, czytelność, reflow i wielkość celów. To przegląd kodu i logiki, nie certyfikacja zgodności.

| Obszar | Wynik |
| --- | --- |
| Nazwy pól i przycisków | Przejrzano formularze, dodano opisy kolumn działań |
| Błędy i stan zapisu | Komunikaty istnieją; blokada powtórnego zapisu objęta testem |
| Operacje nieodwracalne | Trwałe usunięcie profilu wymaga potwierdzenia |
| Klawiatura | Dodano skip link i fokus; pełną kolejność Tab i powrót fokusu z dialogów sprawdzić ręcznie |
| Telefon / powiększenie | Reguły responsywne są obecne; potrzebny test 320/375 px, 200–400% zoom i klawiatury ekranowej |
| Kontrast | Przyciemniono tekst pomocniczy; wszystkich kombinacji stanów nie zmierzono w przeglądarce |
| Skracanie tekstów | Dane pozostają w szczegółach; title jest uzupełnieniem dla myszy, nie rozwiązaniem dla dotyku |
| Układ i animacje | Zachowano mobilne układy, dodano prefers-reduced-motion; brak pełnego testu wizualnego |

Nie usuwano automatycznie całej historycznej kaskady CSS. Część nadpisań nadal może być uproszczona po porównaniu wszystkich ekranów w przeglądarce. Usuwanie ich bez takiej kontroli mogłoby zmienić wygląd.

## Ważne ograniczenie backendu

supabase-access.sql weryfikuje aktywny profil i chroni zmiany profili/ustawień/lokali. Jednak aktywny użytkownik otrzymuje cały rekord usterki_demo_state, a polityki załączników dopuszczają odczyt plików przez każdego aktywnego użytkownika. Filtrowanie zgłoszeń według roli/MPK odbywa się w przeglądarce. Trigger nie waliduje wszystkich zmian zgłoszeń, komentarzy i historii według ich autora.

Dlatego klientowe ograniczenia nie stanowią izolacji danych. Przed wdrożeniem korporacyjnym IT musi zapewnić serwerową autoryzację poszczególnych zgłoszeń/plików/operacji, np. oddzielne tabele z RLS lub własne API. Ta paczka nie wprowadza migracji backendu i nie rozwiązuje tego ograniczenia. Publiczny klucz frontendowy nie zastępuje reguł dostępu.

## Test odbioru na rzeczywistym wdrożeniu

1. Logowanie, odmowa logowania, reset hasła, wylogowanie i wygasanie sesji.
2. Utworzenie zgłoszenia, komentarz, załącznik JPG/PNG/PDF, podgląd i pobranie po odświeżeniu.
3. Dwa równoczesne zapisy, utrata sieci podczas uploadu, ponowienie bez utraty formularza.
4. Zmiana statusu, termin, zamknięcie kierownika z wymaganym załącznikiem, historia.
5. Nadanie/przywrócenie dostępu, ochrona ostatniego administratora, trwałe usunięcie profilu.
6. Próby odczytu i modyfikacji cudzych danych bezpośrednio przez API — po wdrożeniu autoryzacji serwerowej.
7. Instalacja PWA i push na Windows/Android/iOS, zgoda, wyłączone uprawnienie i kliknięcie powiadomienia.
8. Klawiatura, czytnik ekranu, telefon, zoom, kontrast wszystkich stanów i widoczność dialogów.

## Wdrożenie plików

Wgraj cały katalog z views/ i nowymi arkuszami. Usuń z hostingu wskazane stare skrypty, jeśli tam pozostały. Nie trzeba wykonywać SQL z powodu zmian frontendu. Testy i dokumentacja nie są potrzebne na hostingu.
