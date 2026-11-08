# NEXORA Windows-App

Dies ist der Windows-Desktop-Client für NEXORA. Er zeigt die veröffentlichte NEXORA-Web-App in einem eigenen Windows-Fenster. Konten und Notizen bleiben auf dem zentralen Server und sind dadurch für mehrere Nutzer gemeinsam erreichbar.

## Wichtig: erst den Server veröffentlichen

Die Windows-App enthält absichtlich keine lokale Benutzerdatenbank. Zuerst muss das vorhandene NEXORA-Webprojekt online bereitgestellt werden (z. B. über Render mit dauerhaftem Speicher). Beim ersten Start fragt die App nach der HTTPS-Adresse, zum Beispiel `https://dein-projekt.onrender.com`.

## Installer erstellen

Am einfachsten über GitHub Actions:
1. Den gesamten Projektordner in ein GitHub-Repository hochladen.
2. Im Repository den Tab **Actions** öffnen.
3. Den Workflow **Build NEXORA Windows installer** auswählen und **Run workflow** drücken (oder eine Änderung in `windows-app/` pushen).
4. Nach erfolgreichem Lauf unter **Artifacts** `NEXORA-Windows-Setup` herunterladen und entpacken. Darin liegt `NEXORA-Setup-1.0.0.exe`.

Alternativ auf einem Windows-PC mit Node.js 22:
```powershell
cd windows-app
npm install
npm run dist
```
Der Installer liegt danach in `windows-app/dist/`.

## Sicherheit / Veröffentlichung
- Nur die HTTPS-Adresse des eigenen NEXORA-Servers eintragen.
- Keine Passwörter oder Server-Geheimnisse in den App-Code oder GitHub hochladen.
- Vor öffentlicher Verteilung müssen Datenschutz, Admin-Zugriff auf Notizen und Sicherheitsmaßnahmen geprüft werden. Lass eine erwachsene Vertrauensperson die Veröffentlichung mitprüfen.
- Der Installer ist zunächst nicht code-signiert. Windows kann deshalb beim Start eine Warnung anzeigen. Code-Signing ist ein separater kostenpflichtiger Veröffentlichungsschritt.
