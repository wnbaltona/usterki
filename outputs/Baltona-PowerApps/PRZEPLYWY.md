# Power Automate — projekty przepływów do wdrożenia

Nie są to zaimportowane ani aktywne przepływy. Nazwy połączeń, witryna, konta, Teams i adres aplikacji muszą pochodzić z firmowego środowiska. Wszystkie adresy w konfiguracji startowej są puste, a PowiadomieniaAktywne = false.

## Zasady wspólne

- Obsługę danych wykonuje zatwierdzona tożsamość techniczna z dostępem ograniczonym do list aplikacji. Nie używać hasła pracownika wpisanego do aplikacji ani anonimowego webhooka z uprawnieniami administratora.
- Wiarygodna tożsamość zlecającego to systemowy Author komendy utworzonej jego własnym połączeniem SharePoint. Email, Rola, Koordynator i Stan przesłane w JSON nie są poświadczeniem. Żądanie od osoby nieobecnej lub nieaktywnej w Role jest odrzucane.
- Przed odczytem żądania do przetwarzania odbierz jego autorowi prawo edycji tego elementu Komendy i potwierdź blokadę. Następnie odczytaj aktualny, niezmienny zestaw pól i załączników. Nie opieraj się na nieaktualnej kopii danych triggera.
- Tożsamość biznesowa Administrator jest sprawdzana w przepływie. Nie wolno tworzyć przepływu „zmień rolę” wykonującego dowolne JSON-y bez weryfikacji autora.
- Wszystkie daty zapisuj w UTC, konwersję na polski czas stosuj do prezentacji. Nie używaj Modified jako momentu reakcji — zmieniają go również automatyzacje.
- Operacje waliduj listą dozwolonych pól; nigdy nie Patch całego JSON-u. W odpowiedziach i logach nie zwracaj tokenów, haseł ani technicznych szczegółów do użytkownika.
- Dla zmian statusu/kosztu używaj odczytanej wersji i warunkowej aktualizacji ETag/If-Match; konflikt = odśwież dane i ponów świadomie, bez cichego nadpisania cudzej zmiany.
- W MVP przetwarzanie kolejki może mieć współbieżność 1. Zmiany przepływu wymagają testów ponowień oraz równoczesnych operacji. Role/ACL mogą wymagać przebudowy wielu elementów; błąd nie może pozostawiać nieuprawnionego odczytu.

## F00 — Przyjęcie komendy i wykonanie operacji

Trigger: When an item is created or modified na Komendy, reagujący na Stan = Gotowe. Zmiany dokonane przez sam przepływ nie spełniają warunku. Szkic nie uruchamia operacji. Skan naprawczy właściciela odzyskuje utkwione Przetwarzanie po sprawdzeniu kanonicznego klucza; nie polega na ponownym kliknięciu przez użytkownika.

1. Odczytaj ID komendy, zablokuj edycję autora, odczytaj systemowego Author i rolę z Role, a także utrwalone dane i załączniki. Przerwij przy braku roli lub błędzie blokady.
2. Wylicz klucz operacji z GUID listy i ID komendy. Sprawdź, czy została już wykonana — ponowienie nie może tworzyć nowego zgłoszenia, komentarza lub powiadomienia.
3. Zapisz kontrolowany Stan = Przetwarzanie. Nie uznawaj wysłanego przez klienta Stan = Wykonane za autorytatywny.
4. Dla NoweZgloszenie: sprawdź MPK w Lokale i Aktywny; pobierz Miasto/Nazwa/Lokalizacja ze słownika, nie z klienta. Sprawdź wybory typu i alertu, Boolean blokady, opis 10–10000 znaków i załączniki. Odrzuć nieznane pola chronione takie jak Status/KosztNaprawy/DataZamkniecia w żądaniu nowego zgłoszenia.
5. Zgłaszającego ustal z Author, jego firmowy e-mail zapisz małymi literami. DataZgloszenia = data przyjęcia kompletnej komendy; na ponowieniach nie zmieniaj jej. NumerZgloszenia może mieć format UST-2026-000123, gdzie końcówka pochodzi z ID komendy, a rok z jej pierwszego przyjęcia — nie z CountRows ani liczby istniejących zgłoszeń. Wpisz unikatowy KluczZadania. Status = Nowe. Koszt i daty obsługi puste; ewentualny dyżurny z konfiguracji nie ustawia DataPierwszejReakcji.
6. Utwórz prywatny element Zgloszenia. Skopiuj dopuszczone pliki przez Get attachments → Get attachment content → Add attachment. Zanim przyznasz odczyt, sprawdź kompletność listy plików. Podczas ponowienia odnajdź istniejące zgłoszenie po kluczu i uzupełnij tylko brakujące pliki; nie twórz następnego elementu.
7. Nadaj autorowi odczyt zgłoszenia i plików; centrala ma odczyt zgodny z projektem. Po zakończeniu całej operacji ustaw WynikId i Stan = Wykonane, dopiero wtedy potwierdź użytkownikowi przyjęcie.
8. Zapisz do DziennikPowiadomien zlecenia wymaganych wiadomości (F01/F02). Powiadomienie „Nowe” nie może wyprzedzać zakończenia kopiowania i ustawienia ACL. Nie uruchamiaj go surowym triggerem utworzenia niekompletnego elementu Zgloszenia.
9. Gdy którykolwiek krok się nie uda: pozostaw element docelowy prywatny lub w dotychczasowym poprawnym zakresie, zapisz bezpieczny błąd na Komendy, wstrzymaj powiadomienia i kieruj do obsługi retry. Nie wysyłaj sukcesu.

Walidacja plików: liczba, rzeczywisty rozmiar, dopuszczone rozszerzenie i typ, duplikaty nazw, niepuste pliki. Samo sprawdzenie rozszerzenia nie potwierdza bezpieczeństwa zawartości; stosować firmową ochronę przed złośliwymi plikami. Nie kopiować danych do usług poza firmowym środowiskiem.

### Inne operacje kolejki

| Operacja | Autoryzacja i reguły |
|---|---|
| DodajKomentarz | Użytkownik tylko własne zgłoszenie; centrala wszystkie. Zweryfikuj istnienie i odczyt. Tekst 1–5000 znaków; autora/datę ustala przepływ. Klucz komendy unikatowy. ACL komentarza zgodny ze zgłoszeniem. Pierwszy komentarz koordynatora może ustawić DataPierwszejReakcji. |
| AktualizujZgloszenie | Tylko Koordynator/Administrator. Status według macierzy; osoba przypisana z aktywnej roli. Waliduj termin, nieujemny koszt, datę zakończenia i komentarz. Odrzuć konflikt ETag. Pierwsza reakcja ustawiana raz. Dla Zamknięte utwórz zdarzenie F03. |
| ZarzadzajRola | Tylko Administrator. Użytkownik musi istnieć w firmowym katalogu. Zablokuj odebranie ostatniej aktywnej roli Administrator. Zmiana roli wraz z ACL; przy odebraniu praw najpierw blokada biznesowa, potem odebranie szerokiego dostępu. Nie raportuj sukcesu przed kontrolą wszystkich ACL. |
| ZarzadzajLokalem | Tylko Administrator. MPK unikatowe i tekstowe; typ Lokal/Magazyn; dezaktywacja zamiast usunięcia. Bez przepisywania historycznych zgłoszeń. |
| Konfiguracja | Tylko Administrator. Edycja wyłącznie znanych kluczy, walidacja wartości i odbiorców. Nie pozwala zapisać sekretu ani dowolnego adresu webhooka. |

## F01 — Nowe zgłoszenie → e-mail do koordynatora

Zlecenie po pełnym zakończeniu F00. Odbiorca: zweryfikowany koordynator, a przy jego braku zatwierdzona skrzynka AdresAlertowEmail. Jeżeli obie wartości puste: błąd konfiguracji, bez zgadywania odbiorcy.

Temat: `[Nowe][{NumerZgloszenia}] {Miasto} · {NumerLokalu} · {RodzajUsterki}`. Treść: MPK/nazwa, alert, blokada sprzedaży, opis jako bezpieczny tekst, zgłaszający, data i link do aplikacji/rekordu. Załączników nie dołączaj do e-maila; link zachowuje kontrolę dostępu. Klucz dziennika: `NEW:{ID}:Email`.

## F02 — Wysoki alert → e-mail + Teams

Dwa oddzielne klucze i stany dostarczenia: `HIGH:{ID}:{WersjaPrzejscia}:Email` i `HIGH:{ID}:{WersjaPrzejscia}:Teams`. Dla nowego Wysokiego F01 i F02 scalają e-mail w jedną wiadomość oznaczoną wysokim priorytetem, plus Teams, aby nie dublować poczty. Późniejsza zmiana z Niski/Średni na Wysoki tworzy nowe zdarzenie; sama edycja opisu Wysokiego nie wysyła kolejnego alertu.

Teams: wiadomość tylko na zatwierdzonym kanale centrali z kontrolowanym dostępem, nie kanale ogólnofirmowym. Zawartość minimalna: numer, MPK, miasto, rodzaj, blokada sprzedaży i link. Bez zdjęć, pełnego opisu i danych osobowych w kanale o szerszym dostępie. Brak TeamsTeamId/TeamsChannelId = błąd tylko tego kanału, nie blokada przyjęcia zgłoszenia.

Jeśli zmiany mogą być wykonywane administracyjnie poza F00, przepływ wykrywający zmianę korzysta z wersjonowania oraz Get changes for an item z tokenami początku/końca okna triggera. Nie testuje jedynie bieżącego Status = X przy każdej modyfikacji. [Zmiany elementu i wymagane wersjonowanie](https://learn.microsoft.com/en-us/sharepoint/dev/business-apps/power-automate/sharepoint-connector-actions-triggers)

## F03 — Zamknięcie → e-mail do zgłaszającego

Tylko przejście do Zamknięte, nie każda modyfikacja rekordu już zamkniętego. Odbiorca z autorytatywnego EmailZglaszajacego. Treść: numer, lokal, data zakończenia, komentarz zamknięcia, link. Koszt pokazywany zgodnie z ustaloną polityką firmy. Klucz: `CLOSED:{ID}:Email`, ponieważ MVP nie przewiduje ponownego otwierania. Odrzucenie jest widoczne w aplikacji; dodatkowy e-mail o odrzuceniu nie był wymagany i nie jest włączany bez decyzji.

## F04 — Brak reakcji przez 48 h

Recurrence: co godzinę. Pobierz tylko niezamknięte/nieodrzucone, DataPierwszejReakcji pusta, DataZgloszenia ≤ addHours(utcNow(), -48). Godzina planowego uruchomienia oznacza, że e-mail może przyjść między 48 a około 49 godziną, plus opóźnienie usługi.

Przed wysyłką ponownie pobierz aktualny element i sprawdź warunki; ktoś mógł właśnie zareagować. Jedno przypomnienie na zgłoszenie przy tym progu; klucz `NO_RESPONSE_48H:{ID}:Email`. Nie wysyłaj co godzinę tej samej wiadomości. Odbiorca: przypisany aktywny koordynator lub centrala. Brak koordynatora nie wyłącza przypomnienia.

## F05 — Przekroczony termin

Recurrence: co godzinę. TerminRealizacji niepusty i < utcNow(); status inny niż Zamknięte/Odrzucone. Przed wysyłką rewalidacja danych. Klucz zawiera ID oraz aktualny termin UTC, aby odróżnić zmianę terminu; dodatkowo kontroluj minimalny odstęp od ostatniego faktycznie wysłanego alertu dla danego zgłoszenia, startowo 24 h. Zmiana terminu nie może omijać ograniczenia częstotliwości. Zakończenie lub przesunięcie terminu w przyszłość wstrzymuje kolejne alerty.

## F06 — Wysyłka i odporność na powtórzenia

DziennikPowiadomien jest kolejką z unikatowym Klucz. Wstawienie duplikatu klucza nie tworzy następnego zlecenia. Wysyłający atomowo przejmuje wpis przez ETag, Oczekuje → Wysyłanie. PowiadomieniaAktywne = false oznacza pozostawienie w kolejce, bez wysyłki. Po sukcesie zapisz Wysłano i DataWyslania. Dla pewnego błędu przed wysłaniem dopuszczalne ponowienie z opóźnieniem.

Nie można obiecać idealnego exactly-once: dostawca może przyjąć e-mail, a zapis statusu może zawieść. W stanie niejednoznacznym zaznacz Do sprawdzenia i weryfikuj historię wysyłki; nie ponawiaj automatycznie bez kontroli. E-mail i Teams mają odrębne rekordy, więc awaria Teams nie wysyła ponownie poprawnie dostarczonego e-maila. Przed aktywacją należy zdecydować, czy wysyłać zaległe zdarzenia z testów — domyślnie nie.

## F07 — Snapshot dashboardu

Recurrence: startowo co godzinę. Pobierz pełny zakres z Get items i włączoną paginacją; gdy rozmiar przekracza próg paginacji, podziel dane na zakresy ID i dat. Zweryfikuj sumę rekordów, nie zakładaj, że pierwsza strona to cała lista. Wykonuj odczyt ze stabilnym zakresem czasowym/ID na początek przebiegu; podczas równoczesnych edycji raport ma charakter operacyjnego snapshotu, nie księgowej transakcji.

Policz kafelki i przekroje zgodnie z PROJEKT.md, czas w godzinach i próbę zamkniętych. Przy pustym zbiorze średnia = null. Zapisz cały JSON atomowo pod kluczem DashboardSnapshot dopiero po udanym odczycie wszystkich stron. Przy błędzie zachowaj poprzednią wersję i zgłoś administratorowi nieaktualność. Nie udostępniaj snapshotu zwykłym użytkownikom lokali.

## Parametry i test uruchomienia

Najpierw osobna testowa witryna, skrzynka i kanał Teams. Sprawdzić połączenia, właścicieli oraz zakres praw; pracownik ma prawo uruchamiać aplikację, nie edytować przepływów serwisowych. Po odejściu właściciela połączenia trzeba przekazać i ponownie sprawdzić. [Połączenia i użytkownicy run-only](https://learn.microsoft.com/en-us/power-automate/create-team-flows)

Dopiero po TESTY.md i zatwierdzeniu odbiorców włączyć PowiadomieniaAktywne. Pakiet nie wykonuje tego kroku.
