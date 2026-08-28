# Baltona — pakiet przygotowawczy Power Apps

## Stan

Pakiet przygotowany na podstawie specyfikacji użytkownika i pliku Zeszyt1.xlsx. Nie jest opublikowaną aplikacją, plikiem .msapp ani rozwiązaniem .zip do importu w Power Platform. Archiwum zawiera materiały i skrypt do dalszego wdrożenia. Nie utworzono witryny, list, przepływów ani kont w Microsoft 365.

Poprzedni lokalny prototyp strony nie jest częścią tego rozwiązania. Aktualny kierunek: Canvas App + SharePoint + Power Automate. Nie tworzymy własnego ekranu logowania; pracownicy korzystają z firmowej tożsamości. SharePoint nie staje się anonimowy. [Połączenia Power Apps](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/connections-list)

## Zawartość

| Plik | Przeznaczenie |
|---|---|
| lokale-import.json | 72 zweryfikowane obiekty z Excela, gotowe dla skryptu importu |
| schemat-list.json | Trzy listy biznesowe i cztery listy pomocnicze |
| konfiguracja-startowa.json | Parametry startowe; odbiorcy pozostają puści, wysyłka wyłączona |
| Utworz-Listy.ps1 | Domyślnie plan bez połączenia; po świadomym uruchomieniu tworzy listy i importuje dane |
| PROJEKT.md | Model danych, role, reguły, dashboard i zabezpieczenia |
| POWER-APPS.md | Ekrany, kontrolki i formuły do konfiguracji w Studio |
| PRZEPLYWY.md | Kontrakty operacji i projekty przepływów do zbudowania w Power Automate |
| TESTY.md | Testy odbiorowe i kryteria dopuszczenia do publikacji |
| WERYFIKACJA.json | Wyniki lokalnych kontroli pakietu, bez deklaracji testu Microsoft 365 |

## Dane z Excela

67 lokali + 5 magazynów = 72 rekordy. 71 aktywnych, 1 nieaktywny: MPK 206, Food Truck (zamknięty). Wszystkie MPK zapisano jako tekst. Nie ma duplikatów. Puste komórki miasta uzupełniono ostatnią podaną lokalizacją w danej sekcji.

Kraków ujednolicono do KRAKÓW. Lokalizacje terminali A i B zachowano w dodatkowym polu Lokalizacja, a Miasto dla tych rekordów grupuje się pod KATOWICE PYRZOWICE. Nie zmieniono ich na inne miasto. Magazyny nie miały nazw w źródle; dodano opis „Magazyn”, nie udając, że pochodzi z Excela. WierszZrodla umożliwia kontrolę źródła.

## Uruchomienie struktury przez IT

1. Utworzyć dedykowaną prywatną witrynę testową SharePoint. Na tym etapie bez zwykłych członków, grup firmowych i udostępnienia zewnętrznego.
2. Zapewnić PowerShell zgodny z zainstalowaną wersją PnP.PowerShell, zatwierdzony moduł PnP.PowerShell i rejestrację aplikacji PnP z ClientId. Skrypt nie instaluje modułów i nie zmienia polityk uruchamiania. [Połączenie PnP](https://pnp.github.io/powershell/cmdlets/Connect-PnPOnline.html)
3. W katalogu pakietu uruchomić `./Utworz-Listy.ps1` — wyświetli wyłącznie plan i sprawdzi import, bez logowania oraz zmian.
4. Po przeglądzie uprawnień uruchomić wariant poniżej, zastępując wartości w nawiasach własnymi. Interaktywne logowanie nastąpi wyłącznie do wdrożenia; nie wklejać sekretów do czatu.

```powershell
./Utworz-Listy.ps1 -Apply `
  -SiteUrl 'https://<tenant>.sharepoint.com/sites/<witryna-testowa>' `
  -ClientId '<zatwierdzony-client-id>' `
  -PotwierdzamPrywatnaWitryneTestowa
```

Skrypt pyta o potwierdzenie. Nie tworzy witryny. Przerywa, jeśli którakolwiek docelowa lista już istnieje; niczego nie usuwa ani nie nadpisuje. Awaria w trakcie może zostawić część nowych list — trzeba sprawdzić stan przed kolejną próbą. Każda nowa lista ma odłączone dziedziczenie; skrypt nie nadaje uprawnień pracownikom. Przejściowy moment dziedziczenia przy tworzeniu jest powodem wymogu prywatnej witryny bez członków.

5. Skonfigurować tożsamość obsługi przepływów, role, listowe i elementowe uprawnienia opisane w PROJEKT.md.
6. Zbudować Canvas App i przepływy według pozostałych plików. Formuły są fragmentami do Studio, nie automatycznym importem aplikacji.
7. Przejść testy trzema osobnymi kontami, dopiero potem udostępnić i opublikować aplikację. Samo udostępnienie Canvas App nie nadaje uprawnień do danych. [Udostępnianie aplikacji i źródeł](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/share-app)

## Potrzebne przed rzeczywistym wdrożeniem

- URL docelowej witryny SharePoint i środowisko Power Platform.
- Udzielony dostęp administratora/właściciela lub osoba z IT wykonująca wdrożenie.
- Adres pierwszego administratora i lista koordynatorów. Nie utworzono fikcyjnych użytkowników.
- Skrzynka odbiorcza centrali i zatwierdzony kanał Teams.
- Potwierdzenie dostępnych licencji, zasad DLP, połączeń oraz polityki załączników przez IT. Pakiet nie gwarantuje pokrycia licencyjnego.

Nie włączono żadnej automatyzacji i nie wysłano żadnej wiadomości.
