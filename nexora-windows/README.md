# NEXORA

Eine moderne Notizen-Web-App mit offenen Registrierungen, persönlichen Konten und Admin-Bereich.

## Voraussetzungen
- Node.js 20 oder neuer
- Ein Server/Hosting-Anbieter für Node.js, wenn die Website öffentlich erreichbar sein soll

## Lokal starten
1. Entpacke das ZIP.
2. Öffne den Ordner im Terminal.
3. Installiere Abhängigkeiten: `npm install`
4. Kopiere `.env.example` nach `.env`.
5. Trage in `.env` einen eigenen `SESSION_SECRET` (mindestens 32 Zeichen), `ADMIN_USERNAME` und ein starkes `ADMIN_PASSWORD` (mindestens 12 Zeichen) ein.
6. Starte: `npm start`
7. Öffne `http://localhost:3000`.

Das erste Admin-Konto wird beim ersten Start anhand der `.env`-Werte angelegt. Registrierungen sind offen. Weitere Nutzer können im Admin-Bereich zu Admins ernannt werden.

## Wichtig vor Veröffentlichung
- `.env` niemals veröffentlichen oder ins Git-Repository hochladen.
- Ausschließlich über HTTPS betreiben und beim Hosting `NODE_ENV=production` setzen.
- Regelmäßige Backups des `data/`-Ordners einrichten.
- Datenschutz: Die Registrierungsseite weist sichtbar darauf hin, dass Admins Nutzerkonten und Notizen einsehen können. Informiere Nutzer zusätzlich transparent darüber, wer Admin-Rechte hat, wie lange Daten gespeichert werden und wie Konten gelöscht werden können.
- Prüfe vor einem echten öffentlichen Einsatz die rechtlichen Datenschutzpflichten (z. B. DSGVO), Hosting-/Auftragsverarbeitungsvertrag und ein Impressum, soweit erforderlich.
- Die Anwendung ist ein funktionsfähiger Startpunkt, aber noch kein geprüftes, professionell gehärtetes Produktionssystem. Lass sie vor öffentlichem Betrieb technisch und datenschutzrechtlich prüfen.

## Funktionen
- Registrierung und Login mit Benutzername/Passwort
- Passwörter werden mit bcrypt gehasht
- Server-seitige Sitzungen, SQLite-Datenbank
- Nutzer sehen und bearbeiten nur ihre eigenen Notizen
- Admins können Nutzer, Rollen und Sperrstatus verwalten und deren Notizen einsehen
- Light/Dark Mode
- Suche, Notizen erstellen/bearbeiten/löschen


## Veröffentlichung auf Render (mit dauerhafter Datenspeicherung)
Für diese SQLite-Version braucht NEXORA einen persistenten Datenträger. Render bietet persistente Disks für bezahlte Web Services an; ohne persistenten Speicher können Konten und Notizen bei Neustarts/Deployments verloren gehen.

1. Lade dieses Projekt in ein privates GitHub-Repository hoch. `.env`, `data/` und Passwörter niemals hochladen.
2. Erstelle bei Render einen **Web Service** und verbinde das Repository.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Füge unter **Environment** diese Werte hinzu:
   - `NODE_ENV` = `production`
   - `DATA_DIR` = `/var/data`
   - `SESSION_SECRET` = ein langer, zufälliger Wert mit mindestens 32 Zeichen
   - `ADMIN_USERNAME` = dein gewünschter Admin-Benutzername
   - `ADMIN_PASSWORD` = ein neues, starkes Passwort mit mindestens 12 Zeichen
6. Füge unter **Disk** einen persistenten Datenträger hinzu:
   - Mount Path: `/var/data`
   - Größe: kleinste verfügbare passende Größe
7. Deploy starten und die von Render angezeigte `onrender.com`-Adresse öffnen.
8. Mit dem Admin-Benutzernamen und -Passwort aus Schritt 5 anmelden. Danach ein Testkonto registrieren und testen: Notiz erstellen, abmelden, erneut anmelden und Admin-Ansicht prüfen.

Wichtig: Erstelle die Umgebung und den Hosting-Account mit Unterstützung eines Elternteils/Erziehungsberechtigten, falls der Anbieter dies altersbedingt verlangt. Vor dem Teilen mit anderen muss eine erwachsene verantwortliche Person Datenschutz, Nutzungsbedingungen, Moderation und Datensicherheit prüfen. Da Admins fremde Notizen lesen können, muss dieser Hinweis für alle Nutzer klar sichtbar bleiben.
