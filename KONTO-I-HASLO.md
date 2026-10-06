# Moje konto i hasła

Wgraj nową paczkę aplikacji lub podmień pliki z archiwum poprawki. Zawiera ono nowy plik account.js, który jest wymagany. Zmiany nie wymagają SQL.

Panel otwiera się przez kliknięcie „Twoje konto: …”. Administrator ma przycisk „Moje konto” obok przełącznika widoków. Panel zawiera nazwę, e-mail, rolę, MPK, zmianę hasła i wylogowanie. Role i MPK nadal zmienia administrator. W podglądzie testowym panel dotyczy rzeczywistego konta administratora.

Zmiana hasła: wpisz obecne hasło, nowe hasło (minimum 8 znaków) i jego potwierdzenie. Supabase może wymagać silniejszego hasła zgodnie z ustawieniami projektu. Hasła nie są zapisywane w danych aplikacji.

## Ustawienia wymagane dla resetu przez e-mail

1. W Supabase otwórz Authentication → URL Configuration.
2. Ustaw Site URL na pełny adres aplikacji, np. https://NAZWA.github.io/usterki/.
3. Dodaj ten sam adres do Redirect URLs. Jeśli strona jest też otwierana przez /index.html, dodaj także https://NAZWA.github.io/usterki/index.html. Adres musi odpowiadać adresowi w pasku przeglądarki; dla GitHub Pages zachowaj nazwę repozytorium w ścieżce.
4. Dla wiadomości do zwykłych użytkowników skonfiguruj Custom SMTP w ustawieniach Authentication. Bez własnego SMTP domyślny serwer Supabase ogranicza odbiorców do członków zespołu projektu. Dane SMTP wpisuj wyłącznie w panelu Supabase.
5. W Email Templates → Reset Password zachowaj link oparty na {{ .ConfirmationURL }}. Aplikacja obsługuje standardowy powrót Supabase i zdarzenie PASSWORD_RECOVERY.
6. Przetestuj: wyloguj się → „Nie pamiętasz hasła?” → wpisz e-mail → otwórz link z wiadomości → zapisz nowe hasło → sprawdź logowanie nowym hasłem. Link wygasły lub użyty wymaga wysłania nowego.

Wysyłka wiadomości i prawdziwe sesje wymagają testu na wdrożonym projekcie. Lokalne testy używają atrap API i nie wysyłają wiadomości ani nie zmieniają rzeczywistych haseł.

Dokumentacja Supabase:
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/reference/javascript/auth-updateuser
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-smtp
