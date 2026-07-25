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


## Status

Die lokale Speicher-Abstraktion ist abgeschlossen und wird durch GitHub Actions geprüft. Die App startet weiterhin synchron aus dem lokalen Speicher.

## Vorbereitete Cloud-Architektur

Cloud-Synchronisation ersetzt den lokalen Adapter nicht direkt. Stattdessen bleibt der LocalStorageAdapter der Offline-Primärspeicher. Ein asynchroner CloudSyncService synchronisiert ausschließlich die zentral registrierten BudgetQuest-Schlüssel mit einem Cloud-Adapter.

Vor der Live-Aktivierung werden benötigt:

1. Firebase-Projekt und registrierte Web-App.
2. Firebase-Konfigurationsobjekt.
3. aktivierter Authentication-Anbieter.
4. Firestore-Datenbank und geprüfte Security Rules.
5. festgelegte Haushalts- und Mitglieder-IDs.
6. ausdrückliche Freigabe der ersten lokalen Datenmigration.

Die vorbereiteten Klassen sind noch nicht in `index.html` geladen und übertragen deshalb keine Daten.
