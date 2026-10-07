# Testy logiki

Wymagają Node.js wyłącznie do testów. Sama aplikacja nie wymaga Node.js na hostingu.

Z katalogu aplikacji uruchom:

```text
node tests/microsoft.test.cjs
node tests/push.test.cjs
node tests/dashboard.test.cjs
node tests/operations.test.cjs
```

Sprawdzają konfigurację widoku logowania Microsoft, przekierowania, treści push, zakresy dashboardu oraz blokadę powtórnej operacji i obsługę błędu. Używają atrap usług; nie logują do prawdziwej bazy i nie wysyłają powiadomień.
