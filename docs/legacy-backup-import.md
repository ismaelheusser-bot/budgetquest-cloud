# Rückwärtskompatibler Backup-Import

BudgetQuest normalisiert ältere Haushalts-Backups vor dem Speichern. Fehlende Profile, Eigenheim-, Vermögens- und Planungsfelder erhalten sichere Standardwerte. Bekannte ältere Feldnamen werden übernommen. Der ursprüngliche Import bleibt als Fallback im Quellcode erhalten, wird aber nach dem Laden durch das Migrationsmodul ersetzt.
