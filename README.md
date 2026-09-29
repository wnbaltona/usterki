# Serwis Lokali — paczka do publikacji

Prześlij całą zawartość tego katalogu na hosting. Plik index.html musi znaleźć się w głównym katalogu aplikacji. Uruchamiaj stronę przez HTTP/HTTPS, nie przez dwuklik pliku.

Paczka zachowuje aktualny wygląd i wszystkie dotychczasowe funkcje. Zawiera tylko pliki używane przez aplikację oraz licencję czcionki. Nie zawiera starych kopii, nieużywanych ikon, dodatkowej kopii czcionki ani jednorazowych skryptów administracyjnych.

Zachowano istniejącą konfigurację Supabase w app-config.js. Ta paczka jest bieżącą wersją aplikacji korzystającą z Supabase; nie zastępuje osobnej wersji serwerowej dla IT. Logowanie i podgląd PDF wczytują biblioteki z internetu.

Zawartość ZIP jest ułożona bezpośrednio w katalogu głównym — bez kolejnego folderu z kopią aplikacji.

Aktualizacja: kafelki filtrów mają mniejszą, jednolitą minimalną wysokość (86 px na komputerze, 82 px na telefonie), a liczniki Otwarte / W toku / Zamknięte mają cyfry 16 px. Kafelki mogą zwiększyć wysokość przy zawijaniu długiej etykiety.

Aktualizacja wyśrodkowania na telefonie: formularze mają równe marginesy poziome. Okna szczegółów, zamknięcia zgłoszenia, powiadomień i podglądu załączników korzystają ze wspólnego centrowania w oknie przeglądarki i ograniczenia wysokości. Dłuższe okna można przewijać. Na telefonie ukryto pionowy pasek przewijania strony, pozostawiając możliwość przewijania; nie rezerwuje on już miejsca po prawej stronie. Nie zmieniono zachowania paska na komputerze.

Kontrola lokalna: formularz przy 390 i 320 px ma po 16 px marginesu z obu stron; okna szczegółów mają po 12 px i działające przewijanie; zamknięcie zgłoszenia i powiadomienia są wyśrodkowane w pionie i poziomie; logowanie przy 320 px ma równą szerokość. Brak poziomego poszerzania strony i błędów konsoli w sprawdzonych widokach. Kontrola na lokalnych danych testowych.
