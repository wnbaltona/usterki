# Budowa Canvas App w Power Apps Studio

To instrukcja konfiguracji i fragmenty Power Fx, nie wygenerowany plik .msapp. Nie były uruchamiane w Studio. Nazwy kontrolek trzeba nadać dokładnie jak poniżej. Formuły używają zapisu z przecinkiem jako separatorem argumentów i średnikiem jako separatorem instrukcji. W polskiej lokalizacji edytora może być potrzebny odpowiednio średnik i podwójny średnik.

## Ekrany

| Ekran | Zawartość |
|---|---|
| scrStart | Zgłoś usterkę, Moje zgłoszenia; Dashboard dla centrali; Administracja dla administratora |
| scrNowe | Miasto, lokal filtrowany po mieście, zgłaszający, typ, alert, blokada sprzedaży, opis, załączniki |
| scrMoje | Delegowalna lista własnych, filtr statusu, szczegóły |
| scrSzczegoly | Numer, lokal, opis, status, termin, koszt, komentarze, załączniki |
| scrKoordynator | Wszystkie zgłoszenia, filtry, przypisanie, status, termin, koszt, zamknięcie |
| scrDashboard | Kafelki, trzy przekroje, średni czas i data odświeżenia |
| scrAdmin | Role, użytkownicy biznesowi, lokale/magazyny, konfiguracja, raporty |
| scrBrakDostepu | Brak aktywnej roli lub połączenia; bez automatycznego nadawania dostępu |

Responsywny układ: kontenery automatyczne, formularz w jednej kolumnie na telefonie i dwóch na komputerze; opis i załączniki na pełną szerokość. Nawigacja klawiaturą, etykiety AccessibleLabel, priorytety opisane tekstem i kolorem, nie tylko kolorem.

## Źródła i inicjalizacja

Podłącz Lokale, Zgloszenia, Role, Komendy, Komentarze, a dla centrali Konfiguracja. Brak dostępu do Konfiguracja nie może blokować uruchomienia ekranów użytkownika. Nie pobieraj wszystkich zgłoszeń przez ClearCollect.

App.OnStart (startowo słownik 72 obiektów; przy wzroście ponad limit delegacji zmienić ładowanie):

```powerfx
Set(varEmail, Lower(User().Email));
Set(varRola, Blank());
Set(varBladStartu, false);
IfError(
    Set(varProfil, LookUp(Role, Email = varEmail && Aktywny = true));
    Set(varRola, varProfil.Rola.Value);
    ClearCollect(colLokale, Filter(Lokale, Aktywny = true)),
    Set(varBladStartu, true)
);
Set(varCentrala, varRola = "Koordynator" || varRola = "Administrator");
Set(varAdmin, varRola = "Administrator");
Set(varZapisywanie, false);
Set(varMaksPlikow, 5);
Set(varMaksMB, 10)
```

scrStart pokazuje kontrolki dopiero gdy inicjalizacja się zakończy i rola nie jest pusta. Dane z User().Email służą do filtrowania interfejsu; przepływ ustala autora z SharePoint Author. Jeżeli firmowe UPN i adres pocztowy są różne, uzgodnić mapowanie przed importem Role i sprawdzić je w testach.

## Formularz zgłoszenia

Kontrolki klasyczne: ddMiasto, ddLokal (AllowEmptySelection = true), ddRodzaj, ddAlert, tglBlokada, txtOpis. Zgłaszający to etykieta User().FullName z e-mailem, bez możliwości podszycia się pod inną osobę. MPK i nazwa są widoczne razem w dropdownie. Dane do JSON pobieraj z rekordu, nie parsuj tekstu etykiety.

```powerfx
// ddMiasto.Items; Value = "Value"
Sort(Distinct(colLokale, Miasto), Value)

// ddMiasto.OnChange
Reset(ddLokal)

// ddLokal.Items; Value = "Etykieta"
AddColumns(
    Filter(colLokale, Miasto = ddMiasto.Selected.Value),
    Etykieta,
    NumerLokalu & " · " & NazwaLokalu & " · " & Lokalizacja
)

// ddRodzaj.Items; Value = "Value"
Choices(Zgloszenia.RodzajUsterki)

// ddAlert.Items; Value = "Value"
Choices(Zgloszenia.PoziomAlertu)
```

### Wysyłanie i załączniki

Dodaj Edit form `frmKomenda`, DataSource = Komendy, DefaultMode = FormMode.New. Karty formularza: Operacja, Dane, Stan, KluczZadania oraz Attachments. Techniczne karty ukryte, ale ich Update ustawione jak poniżej. Natywna kontrolka załączników `attPliki` musi pozostać w tej karcie formularza; ustaw MaxAttachments = varMaksPlikow i MaxAttachmentSize = varMaksMB. Samodzielna kontrolka poza formularzem ani Patch rekordu nie zastępują zapisu załączników. [Kontrolka Attachments](https://learn.microsoft.com/en-us/power-apps/maker/canvas-apps/controls/control-attachments)

scrNowe.OnVisible:

```powerfx
NewForm(frmKomenda);
Set(varKluczKlienta, Text(GUID()));
Set(varKomendaId, Blank());
Set(varZapisywanie, false)
```

Karty Update:

```powerfx
// Operacja
{Value: "NoweZgloszenie"}
// Stan: tylko po zapisie kompletnego formularza zmienimy na Gotowe
{Value: "Szkic"}
// KluczZadania
varKluczKlienta
// Dane
JSON({
    NumerLokalu: ddLokal.Selected.NumerLokalu,
    RodzajUsterki: ddRodzaj.Selected.Value,
    PoziomAlertu: ddAlert.Selected.Value,
    BlokujeSprzedaz: tglBlokada.Value,
    Opis: Trim(txtOpis.Text)
}, JSONFormat.Compact)
```

Przycisk Wyślij.OnSelect:

```powerfx
If(
    varZapisywanie,
    false,
    If(
        IsBlank(ddLokal.Selected.NumerLokalu) ||
        IsBlank(ddRodzaj.Selected.Value) ||
        IsBlank(ddAlert.Selected.Value) ||
        Len(Trim(txtOpis.Text)) < 10 ||
        Len(Trim(txtOpis.Text)) > 10000,
        Notify("Wybierz lokal, rodzaj i alert oraz wpisz opis (10–10000 znaków).", NotificationType.Error),
        Set(varZapisywanie, true);
        SubmitForm(frmKomenda)
    )
)
```

Przycisk DisplayMode = If(varZapisywanie, DisplayMode.Disabled, DisplayMode.Edit). attPliki.OnAddFile powinien sygnalizować niedozwolone rozszerzenia; walidacja przepływu jest obowiązkowa nawet jeśli klient odrzuca plik. Nie otwieraj plików HTML/SVG osadzonych w aplikacji.

frmKomenda.OnSuccess:

```powerfx
Set(varKomendaId, frmKomenda.LastSubmit.ID);
IfError(
    Patch(Komendy, frmKomenda.LastSubmit, {Stan: {Value: "Gotowe"}});
    Notify("Przesłano do przetworzenia. Czekamy na numer zgłoszenia.", NotificationType.Information),
    Set(varZapisywanie, false);
    Notify("Zapisano szkic, lecz nie udało się go wysłać do obsługi. Ponów wysłanie istniejącego szkicu.", NotificationType.Error)
)
```

frmKomenda.OnFailure:

```powerfx
Set(varZapisywanie, false);
Notify("Nie udało się zapisać formularza: " & frmKomenda.Error, NotificationType.Error)
```

Przy ponowieniu po niejednoznacznej awarii najpierw odszukaj własną Komendę po varKluczKlienta. Nie wywołuj kolejnego NewForm i nie generuj kolejnego GUID automatycznie. W przypadku częściowego zapisu załączników pozwól użytkownikowi skontrolować i uzupełnić szkic przed ustawieniem Gotowe.

Timer `tmrWynik` co 3 s, maksymalnie przez 60 s, odświeża Komendy i sprawdza wyłącznie varKomendaId. Dla Wykonane dodatkowo odczytuje Zgloszenia po WynikId, potwierdza sukces i nawiguje do szczegółów. Dla Błąd pokazuje bezpieczny komunikat. Po 60 s wyświetla „Wciąż przetwarzamy — sprawdź później”, nie „Zgłoszenie zapisane”. Kolejka gotowa do przetworzenia jest już tylko do odczytu; wynik w interfejsie nie zastępuje odczytu faktycznego zgłoszenia.

## Moje zgłoszenia

`ddStatus.Items` zawiera „Wszystkie” i sześć statusów ze specyfikacji. Gallery.Items używa jawnych gałęzi, nie lokalnej kolekcji wszystkich rekordów:

```powerfx
If(
    ddStatus.Selected.Value = "Wszystkie",
    SortByColumns(Filter(Zgloszenia, EmailZglaszajacego = varEmail), "DataZgloszenia", SortOrder.Descending),
    SortByColumns(Filter(Zgloszenia, EmailZglaszajacego = varEmail && Status.Value = ddStatus.Selected.Value), "DataZgloszenia", SortOrder.Descending)
)
```

W Studio sprawdzić ostrzeżenia delegacji dla rzeczywistego konektora i testować na liście ponad 2000 rekordów. Nie wykonywać Lower(EmailZglaszajacego) na całej kolumnie — dane są już zapisane małymi literami. Widoczność szczegółów i plików ograniczają także ACL SharePoint.

## Komentarze, koordynator i administracja

`scrSzczegoly`: Display form dla rekordu, w tym karta Attachments w trybie View. Komentarze: `SortByColumns(Filter(Komentarze, ZgloszenieId = varZgloszenie.ID), "DataKomentarza", SortOrder.Ascending)`.

Dodanie komentarza: utwórz Komendę z Operacja = DodajKomentarz, ZgloszenieId i Dane = JSON({Tresc: Trim(txtKomentarz.Text)}). Poczekaj na potwierdzenie przetworzenia, potem Refresh(Komentarze). Błędu nie przedstawiać jako sukcesu. Komentarz nie trafia bezpośrednio przez Patch do listy Komentarze.

`scrKoordynator`: analogiczne delegowalne filtry Status, Miasto, NumerLokalu, EmailKoordynatora; tabela z datą, numerem, MPK/nazwą, alertem, blokadą sprzedaży, statusem, koordynatorem, terminem. Zmiany wysyłane jako AktualizujZgloszenie z ID oraz oczekiwaną wersją/ETag. Wszystkie walidacje ponawia przepływ. Nazwy/UPN dostępnych koordynatorów dostarcza zatwierdzony odczyt serwerowy; rola zwykłego użytkownika nie otrzymuje całej listy Role.

`scrAdmin`: biznesowe wpisy użytkowników, aktywacja/dezaktywacja i role; nie tworzy kont Microsoft 365. Lokale/magazyny: edycja słownika, dodanie unikatowego MPK, dezaktywacja zamiast usuwania. Zmiana roli → komenda → przebudowa ACL → potwierdzenie. Raporty i konfiguracja tylko dla administratora. Zablokować usunięcie/dezaktywację ostatniego administratora.

`scrDashboard`: odczyt DashboardSnapshot z Konfiguracja, ParseJSON na zdefiniowanym kontrakcie i kolekcje wyłącznie z małych agregatów. Pola snapshotu: calculatedAtUtc, periodStartUtc, periodEndUtc, total, new, inProgress, closed, critical, closedSampleSize, meanResolutionHours, byCity[], byType[], byLocation[]. Brak snapshotu lub błąd parsowania → komunikat „Raport niedostępny”, nie zera. Nie sumować rekordów pobranych częściowo do galerii.

## Publikacja

Save → App checker (formuły, delegacja, dostępność) → testy na kontach trzech ról → Publish → Share z wybranymi grupami. To odrębne czynności od utworzenia list. Materiały w tym pakiecie ich nie wykonują.
