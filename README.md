# Vertriebsapp

Ein kleiner statischer MVP fuer projektbasierte Vertriebsrouten.

## Funktionen

- Projekte mit Start, Ziel, Zwischenorten, Suchbegriffen und Routenkorridor anlegen
- Echte OpenStreetMap-Karte ueber Leaflet
- Auto- oder Fahrradroute ueber OSRM berechnen
- Betriebe entlang der Route ueber Overpass/OpenStreetMap suchen
- Leads je Projekt verwalten
- Status, Prioritaet und naechsten Schritt pflegen
- CSV-Export fuer Excel oder Google Sheets
- Speicherung im Browser per `localStorage`

## Start

Lokal:

```powershell
npm start
```

Danach laeuft die App unter `http://127.0.0.1:8765`.

Fuer Karte, Routing und Lead-Suche braucht der Browser Internetzugriff auf:

- `unpkg.com` fuer Leaflet
- `tile.openstreetmap.org` fuer Kartenkacheln
- `nominatim.openstreetmap.org` fuer Ortsgeocoding
- `router.project-osrm.org` fuer Auto-/Fahrradrouten
- `overpass-api.de` fuer die OpenStreetMap-Suche entlang der Route

## Vercel Deploy

Die App ist fuer Vercel vorbereitet:

- Frontend liegt statisch im Projektroot (`index.html`, `app.js`, `styles.css`)
- Websitepruefung liegt als Serverless Function unter `api/check-website.js`
- `vercel.json` setzt die Function-Dauer und deaktiviert Caching

Deploy:

```powershell
npm i -g vercel
vercel login
vercel
vercel --prod
```

Bei den Vercel-Fragen:

- Framework Preset: `Other`
- Build Command: leer lassen
- Output Directory: leer lassen oder `.`

Wichtig: Projekte und Leads werden aktuell per `localStorage` im jeweiligen Browser gespeichert. Handy und PC teilen die Daten erst dann automatisch, wenn eine gemeinsame Datenbank angebunden wird.

## Naechste sinnvolle Ausbaustufen

1. Direkten Google-Sheets-Export per OAuth ergaenzen.
2. Kontakte, Telefonnotizen und Wiedervorlagen als eigenes Modul ausbauen.
3. Fuer hoehere Datenqualitaet optional Google Places anbinden.
4. Eine eigene kleine Backend-API bauen, damit API-Keys und Limits sauber verwaltet werden.
