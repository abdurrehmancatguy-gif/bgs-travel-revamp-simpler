# BGS Travel and Tourism — Site Revamp

A cinematic single-page site for BGS Travel & Tourism. Static: no build step, no
dependencies, no server code. Enquiries leave via WhatsApp.

## Running it

```bash
python3 -m http.server 3000 --directory .
```

Then open http://localhost:3000.

## Layout

- `index.html` — the whole page; every scene is a section of one pinned scroll rig
- `styles.css` — layout driven by CSS custom properties that `js/main.js` rewrites per frame
- `js/main.js` — the scroll engine: scene timing, parallax, and all the custom properties
- `js/carousel.js` — the package rail
- `js/navigation.js` — header menus and the mobile drawer
- `js/package-dialog.js` — the package detail dialog
- `data/` — packages, navigation, imagery and icons (the only content sources)
- `utils/whatsapp.js` — enquiry link builders
- `brand/` — logo
- `reference/screenshots/` — the previous site, captured 2026-07-31

## Cache busting

`index.html` and every internal module import carry a `?v=N` query. **Bump that
number whenever you edit a JS or CSS file**, or browsers will keep serving the
old one — they do so aggressively enough to survive a hard refresh.

```bash
V=24 && sed -i '' -E "s/\?v=[0-9]+/?v=$V/g" index.html js/*.js data/packages.js
```
