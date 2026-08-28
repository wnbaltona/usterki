# Testy odbiorowe przed publikacją

Status wszystkich testów środowiskowych: DO WYKONANIA w firmowym Microsoft 365. Lokalne sprawdzenie danych i składni opisuje WERYFIKACJA.json; nie zastępuje tych testów.

| ID | Scenariusz | Oczekiwany wynik |
|---|---|---|
| D01 | Import z Zeszyt1.xlsx | 67 lokali, 5 magazynów, 72 unikatowe tekstowe MPK; 71 aktywnych |
| D02 | MPK 206 | Widoczny administratorowi jako nieaktywny; niedostępny w nowym zgłoszeniu |
| D03 | Katowice terminal A/B | Jedno grupowanie miasta; zachowany terminal przy MPK i w historii |
| D04 | Zmiana nazwy lub dezaktywacja lokalu | Stare zgłoszenie zachowuje pierwotne dane; nowe blokuje nieaktywny obiekt |
| D05 | Ten sam MPK dodawany równocześnie | Unikatowość w SharePoint blokuje duplikat |
| U01 | Konto bez Role lub nieaktywne | Brak dostępu do operacji, także bezpośrednio przez API/kolejkę |
| U02 | Dwaj użytkownicy A/B | A widzi wyłącznie własne zgłoszenia; próba URL/ID B i pliku B daje odmowę |
| U03 | Użytkownik zmienia JSON: Rola=Administrator, Status=Zamknięte, Koszt=0 | Operacja odrzucona; stan docelowy bez zmian |
| U04 | Bezpośredni zapis do Zgloszenia/Role przez użytkownika | Odmowa SharePoint, niezależna od widoczności przycisków |
| U05 | Komentarz użytkownika do cudzego ID | Odmowa; nie powstaje komentarz ani informacja ujawniająca treść cudzego zgłoszenia |
| U06 | Koordynator | Widzi wszystkie, przypisuje i zmienia status/koszt/termin; nie nadaje ról |
| U07 | Dezaktywacja lub obniżenie roli koordynatora | Odebrany szeroki odczyt i możliwość wykonania nowych operacji, także w starej sesji |
| U08 | Odebranie ostatniej roli Administrator | Operacja zablokowana |
| F01 | Formularz bez lokalu, alertu, typu lub poprawnego opisu | Błąd przed wysyłką oraz niezależna walidacja przepływu |
| F02 | Zmiana miasta | Poprzedni lokal jest resetowany; lista obejmuje wyłącznie nowe miasto |
| F03 | JPG/PNG/PDF w granicach limitów | Poprawne zapisanie, skopiowanie i pobranie; potwierdzenie po zakończeniu ACL i kopiowania |
| F04 | 6 plików, >10 MB, pusty lub niedozwolony plik | Brak przyjęcia; jasny komunikat, brak częściowo ujawnionego zgłoszenia |
| F05 | Awaria sieci po SubmitForm, przed Gotowe | Dostępny szkic i ponowienie tego samego żądania; bez duplikatów |
| F06 | Podwójne kliknięcie, retry triggera, awaria po utworzeniu zgłoszenia | Jeden docelowy rekord i komplet plików po wznowieniu |
| F07 | Modyfikacja Komendy podczas przyjęcia | Blokada edycji i spójny odczyt; brak zamiany danych/plików po walidacji |
| F08 | Brak uprawnień do ustawienia ACL | Brak sukcesu i powiadomień, rekord nie zostaje publicznie dostępny |
| S01 | Przejście niewymienione w macierzy | Odmowa w przepływie; nie tylko w UI |
| S02 | Zamknięcie bez komentarza/kosztu; koszt ujemny | Odmowa; 0 dopuszczalne jako jawny koszt zerowy |
| S03 | Odrzucenie z uzasadnieniem | Status Odrzucone, data zakończenia; nie wchodzi do średniego czasu napraw |
| S04 | Dwie jednoczesne zmiany statusu | Konflikt wersji, bez cichego nadpisania |
| S05 | Automatyczne przypisanie i techniczna modyfikacja | Nie ustawiają DataPierwszejReakcji |
| S06 | Pierwszy komentarz/reakcja koordynatora | DataPierwszejReakcji ustawiona raz, nie resetowana |
| P01 | Nowe Niskie/Średnie | Jeden e-mail po pełnym przyjęciu; bez Teams |
| P02 | Nowe Wysokie | Jeden pilny e-mail i jedna wiadomość Teams; bez drugiego zwykłego e-maila |
| P03 | Edycja opisu Wysokiego | Brak kolejnej eskalacji, chyba że rzeczywiście ponownie podniesiono priorytet |
| P04 | Zamknięcie i retry powiadomienia | Jeden logiczny wpis wysyłki; niejednoznaczna awaria kierowana do weryfikacji |
| P05 | 47 h 59 min / 48 h i najbliższy przebieg | Brak przed progiem; po progu przypomnienie raz, także bez przypisanego koordynatora |
| P06 | Reakcja przed wysłaniem planowego przypomnienia | Rewalidacja anuluje nieaktualną wiadomość |
| P07 | Termin pusty/przyszły/przeszły | Alert tylko dla przeszłego i otwartego; powtórzenia nie częściej niż 24 h |
| P08 | Przesunięcie terminu, zamknięcie lub odrzucenie | Wstrzymane nieaktualne alerty |
| P09 | Awaria Teams po sukcesie e-maila | Brak ponownej wysyłki e-maila |
| P10 | PowiadomieniaAktywne=false lub pusty adres | Brak wysyłki; widoczna przyczyna w logu |
| R01 | Ponad 2000 zgłoszeń / wiele stron SharePoint | Pełne wyniki filtrów i agregatów; brak cichego obcięcia do kolekcji |
| R02 | Zamknięte po 2 h i 4 h, Odrzucone po 100 h | Średnia = 3 h, próba = 2; odrzucenie pominięte |
| R03 | Brak zamkniętych | Średnia „Brak danych”, nie 0 h |
| R04 | Wysoki zamknięty + Niski otwarty z blokadą sprzedaży | Krytyczne = 1 |
| R05 | Zmiana czasu letni/zimowy | Poprawne różnice UTC i prezentacja czasu polskiego |
| R06 | Niepełny odczyt/błąd snapshotu | Stary raport z datą i ostrzeżeniem; bez publikacji zaniżonych wyników |
| A01 | Telefon, klawiatura, czytnik ekranu | Czytelne etykiety, kolejność fokusu, brak poziomego ucinania formularza |
| A02 | Wylogowanie/wygaśnięcie połączenia | Brak potwierdzenia niezapisanych danych; jasny komunikat |

## Warunki odbioru

Nie publikować do pracowników do czasu zakończenia U01–U08, F03–F08 i testów powiadomień z rzeczywistymi kontami. Potwierdzić licencje, DLP, właścicieli połączeń, kanał Teams, politykę plików, retencję i odtwarzanie danych. Zachować wyniki testów, daty, konta i dowody w firmowym repozytorium z odpowiednim dostępem.

Dostępność testowej aplikacji i utworzenie list nie oznaczają ukończenia wdrożenia. Odbiór obejmuje działający formularz, komentarze, obsługę koordynatora, administrację, uprawnienia danych, pełne raporty i wszystkie pięć żądanych automatyzacji.
