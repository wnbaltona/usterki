# Wyłączenie powiadomień push

W tej wersji aplikacji pozostają powiadomienia **wewnątrz aplikacji**. Nie ma już przycisku włączania powiadomień telefonu, a nowy `app-sw.js` zastępuje poprzedni worker push i wyłącza subskrypcję na urządzeniu po otwarciu zaktualizowanej strony.

Jeżeli konfiguracja push w Supabase była wcześniej uruchomiona, wykonaj dodatkowo poniższe kroki. Samo opublikowanie plików na GitHub Pages nie wyłącza serwerowej wysyłki na urządzenia, które jeszcze nie otworzyły nowej wersji.

1. W Supabase otwórz **SQL Editor** i uruchom `supabase-push-disable.sql`. Usuwa kolejkę push i zapisane subskrypcje. Nie usuwa zgłoszeń ani powiadomień widocznych w aplikacji.
2. W **Database → Webhooks** usuń webhook dla `usterki_push_jobs`, jeśli nadal widnieje na liście.
3. W **Edge Functions** usuń `send-push`, jeżeli została wdrożona. Można również usunąć nieużywane sekrety `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` i `PUSH_WEBHOOK_TOKEN`.
4. Opublikuj cały aktualny katalog aplikacji, w tym `index.html`, pliki `model.js` i `app-*.js`, `bootstrap.js`, `app-sw.js` oraz arkusze CSS.

Jeżeli push nigdy nie był konfigurowany w Supabase, wystarczy opublikowanie nowych plików. Osoby z już zainstalowaną aplikacją powinny ją otworzyć i odświeżyć, aby zastąpić stary worker.
