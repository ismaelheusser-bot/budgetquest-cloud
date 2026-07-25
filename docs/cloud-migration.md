# BudgetQuest Cloud – Migrationsplan

## Ziel

Die bestehende deutsche BudgetQuest-App bleibt während des Umbaus funktionsfähig. Der direkte Zugriff auf `localStorage` wird schrittweise durch eine zentrale Speicher-Schnittstelle ersetzt. Danach kann derselbe Anwendungscode wahlweise lokal oder mit Firebase arbeiten.

## Reihenfolge

1. StorageService und LocalStorageAdapter einführen.
2. Bestehende Schlüssel unverändert übernehmen.
3. Direkte Speicherzugriffe modulweise ersetzen.
4. Datenexport und Migration testen.
5. FirebaseAdapter ergänzen.
6. Anmeldung und Haushaltszuordnung aktivieren.
7. Synchronisation zuerst für Testhaushalte freigeben.

## Bestehende Hauptschlüssel

- `bq_settings`
- `bq_budgets`
- `bq_tx`
- `bq_household`
- `bq_xp`

## Sicherheitsprinzip

Bis Firebase vollständig getestet ist, bleibt der LocalStorageAdapter der aktive Standard. Dadurch startet BudgetQuest weiterhin offline und bestehende Nutzerdaten bleiben erhalten.
