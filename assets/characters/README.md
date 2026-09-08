# Character assets reference

The current production character art is still embedded in `index.html` as Base64 JPEG data inside the global `IMG` object.

## Stable character keys

Use `character_map.csv` as the canonical key-to-filename map. Examples:

- `poo-270C` → PO 270C
- `ssial-1180Y` → CR 1180Y
- `ga-980Y` → GA 980Y

## Visual browser

Open `/character-reference.html` on GitHub Pages. It loads `index.html` in a same-origin hidden iframe and reads the live `IMG` object, so the gallery always reflects the currently embedded character art without duplicating Base64 data.

## Redesign workflow

Keep these keys unchanged when redesigning characters. New externalized assets should eventually live under `assets/characters/redesign/` and can replace the Base64 values without changing gameplay state or grade IDs.
