# Anleitung

Technische Details zur Pflege dieser Seite. Für einen kurzen Überblick siehe die [README](README.md).

## Jede Woche aktualisieren
1. Im Ordner `weeks/` eine neue Datei anlegen, benannt nach dem **Montag** der Woche, z. B. `2026-09-21.json`, und den Wochenplan hineinkopieren.
2. `weeks/index.txt` öffnen und eine Zeile mit dem neuen Dateinamen ergänzen.
3. Etwa eine Minute warten, dann die Seite prüfen.

Alte Wochen bleiben automatisch im Archiv erhalten.

## Foto und Beschreibung zu einem Hauptgericht hinzufügen
Nur das Hauptgericht (das vorletzte Gericht einer Mahlzeit, vor Nachtisch/Obst) kann ein Foto und eine Beschreibung bekommen. Es erscheint automatisch in jeder Woche, in der genau dieser Gerichtname wieder vorkommt.

1. Ein Foto in den Ordner `images/` legen, z. B. `images/lasagne-bolognese.jpg`.
2. `dishes.json` öffnen und einen Eintrag ergänzen, mit dem **genauen** Gerichtnamen aus der Wochen-Datei als Schlüssel:
   ```json
   {
     "Lasagne Bolognese": {
       "image": "images/lasagne-bolognese.jpg",
       "description": "Ofennudeln mit Rinderhack-Tomatensauce und Béchamel."
     }
   }
   ```
   `image` und `description` sind beide optional – auch nur eines von beiden reicht. Mehrere Einträge werden mit Komma getrennt.
3. Commit. Das Gericht ist danach gepunktet unterstrichen; ein Klick (am Computer auch schon ein Überfahren mit der Maus) zeigt Foto und Beschreibung.

Ändert sich der Wortlaut in einer späteren Woche leicht, greift der Eintrag nicht mehr – der Name muss genau wie in der jeweiligen Wochen-Datei geschrieben sein.

## Essenszeiten anpassen
Ganz oben in `app.js` steht ein Block `MEAL_TIMES` mit den Uhrzeiten für Mittag- und Abendessen. Diese Zeiten legen zweierlei fest: was in der Leiste neben "Mittagessen"/"Abendessen" steht, und welche der beiden Mahlzeiten am heutigen Tag mit einem Balken als "als Nächstes" markiert wird.

```js
var MEAL_TIMES = {
  lunch: { start: "11:30", end: "13:00" },
  dinner: { start: "18:00", end: "18:30" }
};
```

Zum Ändern: die vier Uhrzeiten (`"11:30"` usw.) anpassen und committen.

## Farben der Allergene
`allergens.json` legt Reihenfolge, Name und Farbe jedes Buchstabens fest:
```json
{ "code": "A", "name": "Gluten", "color": "#c8102e" }
```
`color` ist optional (ohne Angabe erscheint ein neutrales Grau). Die Reihenfolge in der Datei bestimmt die Reihenfolge auf der ganzen Seite.

## Dateien
- `index.html`, `style.css`, `app.js` – die Website
- `allergens.json` – Bedeutung, Reihenfolge und Farbe der Allergen-Buchstaben
- `dishes.json` – Foto und Beschreibung je Hauptgericht (siehe oben)
- `images/` – Fotos, auf die `dishes.json` verweist
- `weeks/` – eine JSON-Datei pro Woche plus `index.txt`

## Lokale Vorschau
Im Ordner `python3 -m http.server` ausführen und http://localhost:8000 öffnen.
`index.html` per Doppelklick öffnen funktioniert nicht, da Browser das Nachladen der Daten-Dateien dann blockieren.
