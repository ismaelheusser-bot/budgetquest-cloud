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

## Firebase-Grundlage

Die Web-App `budgetquest-cloud` ist mit dem Firebase JavaScript SDK 12.16.0 konfiguriert. Im Haushaltsdialog steht eine Google-Anmeldung per sicherem Popup zur Verfügung. Die Anmeldung allein startet keine Datensynchronisation.

In der Firebase Console ist der Anbieter **Google** aktiviert. BudgetQuest speichert kein eigenes Passwort; Firebase übernimmt die Anmeldung beim ausgewählten Google-Konto.

Die Firestore-Regeln erlauben den Zugriff ausschließlich angemeldeten Mitgliedern eines Haushalts. Ein neuer Haushalt wird zunächst nur für seinen Eigentümer angelegt. Die Regeln müssen vor einer späteren Cloud-Aktivierung mit der Firebase CLI veröffentlicht und im Rules Simulator geprüft werden.

## Aktuelle Sicherheitsgrenze

Die Firebase-Grundlage ist in `index.html` geladen, der `CloudSyncService` dagegen weiterhin nicht. Anmeldung und Firestore-Initialisierung übertragen deshalb noch keine Budget-, Profil- oder Transaktionsdaten. Bestehende lokale Daten bleiben unverändert erhalten. Die erste Migration erfordert weiterhin eine ausdrückliche Bestätigung in der App.
