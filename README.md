# Serwis Lokali — paczka do publikacji

Prześlij całą zawartość tego katalogu na hosting. Plik index.html musi znaleźć się w głównym katalogu aplikacji. Uruchamiaj stronę przez HTTP/HTTPS, nie przez dwuklik pliku.

Paczka zachowuje aktualny wygląd i wszystkie dotychczasowe funkcje. Zawiera tylko pliki używane przez aplikację oraz licencję czcionki. Nie zawiera starych kopii, nieużywanych ikon, dodatkowej kopii czcionki ani jednorazowych skryptów administracyjnych.

Zachowano istniejącą konfigurację Supabase w app-config.js. Ta paczka jest bieżącą wersją aplikacji korzystającą z Supabase; nie zastępuje osobnej wersji serwerowej dla IT. Logowanie i podgląd PDF wczytują biblioteki z internetu.

Zawartość ZIP jest ułożona bezpośrednio w katalogu głównym — bez kolejnego folderu z kopią aplikacji.

Aktualizacja: kafelki filtrów mają mniejszą, jednolitą minimalną wysokość (86 px na komputerze, 82 px na telefonie), a liczniki Otwarte / W toku / Zamknięte mają cyfry 16 px. Kafelki mogą zwiększyć wysokość przy zawijaniu długiej etykiety.

Aktualizacja wyśrodkowania na telefonie: formularze mają równe marginesy poziome. Okna szczegółów, zamknięcia zgłoszenia, powiadomień i podglądu załączników korzystają ze wspólnego centrowania w oknie przeglądarki i ograniczenia wysokości. Dłuższe okna można przewijać. Na telefonie ukryto pionowy pasek przewijania strony, pozostawiając możliwość przewijania; nie rezerwuje on już miejsca po prawej stronie. Nie zmieniono zachowania paska na komputerze.

Kontrola lokalna: formularz przy 390 i 320 px ma po 16 px marginesu z obu stron; okna szczegółów mają po 12 px i działające przewijanie; zamknięcie zgłoszenia i powiadomienia są wyśrodkowane w pionie i poziomie; logowanie przy 320 px ma równą szerokość. Brak poziomego poszerzania strony i błędów konsoli w sprawdzonych widokach. Kontrola na lokalnych danych testowych.

Aktualizacja logowania na komputerze: wyśrodkowana karta 480 px, krótszy falowany nagłówek, subtelne tło i cień, większe marginesy formularza, czytelniejsze pola i odnośniki oraz mniejszy odstęp przed przyciskiem. Przy niższych ekranach panel dodatkowo zmniejsza wysokość. Brak logo i nazwy aplikacji; telefon zachowuje dotychczasowy układ.

Kontrola lokalna przy 1366×900 i 1366×620: równe marginesy po obu stronach i w pionie, brak poziomego poszerzania strony; podgląd hasła działa bez podświetlenia tła. Kontrola mobilna przy 390×844: karta wypełnia szerokość telefonu i zachowuje dotychczasową wysokość dekoracji. Brak błędów konsoli w sprawdzonych widokach.

Aktualizacja grup lokali: MPK z wykazu gastro/F&B są przypisane do grupy Gastro / F&B; pozostałe sklepy do TR / fashion, magazyny osobno. W formularzu po wyborze lokalu pojawia się wyłącznie lista odpowiednich rodzajów usterek, bez pola wyszukiwania i dodatkowych tekstów pomocniczych. Kategorie niepasujące do grupy są ukrywane i odrzucane podczas zapisu. Domyślna lista zawiera 40 kategorii. Jeśli administrator wcześniej zmienił listę, pozostaje ona bez zmian; automatycznie rozszerzana jest tylko oryginalna lista dziewięciu kategorii. Nowy lokal można przypisać do grupy w Administracji.

Poprawka tabeli zgłoszeń: nagłówek i wartości kolumny „Rodzaj usterki” są wyśrodkowane w widoku komputerowym. Układ mobilny pozostaje bez zmian.

Poprawka strony głównej: w szerokich kartach zgłoszeń priorytet jest osobną kolumną w tym samym rzędzie co pozostałe dane i przyciski. Przy mniejszej szerokości pozostaje układ responsywny.

Ikona aplikacji pochodzi bezpośrednio z załącznika użytkowniczki: ciemne koło zębate z kluczem na białym tle. Zachowano rysunek i przygotowano kwadratowe pliki PNG 192 i 512 px dla menu, karty przeglądarki i aplikacji instalowanej.

Dashboard: usunięto wykres „Rodzaje usterek”. Pozostałe wykresy „Miasta” i „Lokale i magazyny” zajmują obie kolumny na komputerze, a na telefonie układają się jeden pod drugim.

W sekcji „Starsze otwarte zgłoszenia” etykieta „Usterka” i treść kolumny są wyśrodkowane w widoku komputerowym.

Ikona aplikacji ma przezroczyste tło; w ciemnym pasku bocznym jej znak wyświetla się na biało.
