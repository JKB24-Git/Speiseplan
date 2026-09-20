# Speiseplan

Weekly meal plan website (static, no server needed).

## Update every week
1. In the `weeks/` folder create a new file named after the **Monday** of the week, e.g. `2026-09-21.json`, and paste the week's JSON into it.
2. Open `weeks/index.txt` and add a line with the new file name.
3. Wait about a minute, then open the site and check it.

Old weeks stay in the archive automatically.

## Files
- `index.html`, `style.css`, `app.js` – the website
- `allergens.json` – meaning of the allergen letters (check it against your kitchen's official list)
- `weeks/` – one JSON file per week plus `index.txt`

To preview on your own computer, run `python3 -m http.server` in this folder and open http://localhost:8000
(opening `index.html` by double-click does not work because browsers block loading the data files).
