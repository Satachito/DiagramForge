# DiagramForge

Canvas-based diagram editor for **cloud architecture**, **mind maps**, and **sequence diagrams**.

**Live demo:** https://satachito.github.io/DiagramForge/

No install, no build step — open the page and start drawing. Diagrams are plain JSON (`.cde`), so they are easy to edit by hand or with AI.

## Features

- **4096 × 4096 canvas** with pan/zoom
- **Shapes** — rect, ellipse, rhombus, SVG, PNG
- **Links** with arrowheads and anchor points
- **Cloud icon palettes** — AWS, Azure, GCP (bundled ZIP archives)
- **Sample diagrams** — JSON primitives, cloud layouts, mind map, sequence chart
- **Import / export** — load and save `.cde` files (↑ / ↓ buttons)
- **Session restore** — last diagram is kept in `localStorage`
- **Light / dark mode** — follows system preference

## Quick start

1. Open the [live demo](https://satachito.github.io/DiagramForge/).
2. Click a **Sample( … )** button on the right panel to load an example.
3. Drag on the canvas to move nodes; use the mode selector to create nodes and links.
4. Expand **GCP / Azure / AWS** in the left panel to place cloud icons.
5. Press **↓** to download the diagram as a `.cde` file.

## `.cde` format

A `.cde` file is JSON with two arrays:

```json
{
	"nodes": [],
	"links": []
}
```

Each node is `[ ID, area, paint ]`. Each link is `[ [ fromID, ends, toID ], paint ]`.

Full schema and authoring rules for AI edits: **[Web/SCHEMA.md](Web/SCHEMA.md)**

Sample files live in **[Samples/](Samples/)**.

## Run locally

The app is static files under `Web/`. Serve that folder and open `index.html`:

```bash
cd Web
python3 -m http.server 8080
# http://localhost:8080/index.html
```

`Web/Samples` is a symlink to `../Samples`. Icon ZIPs are symlinked from `ICONs/`.

## Development

```bash
cd Web
npm install
npm run lint
```

GitHub Pages deploys from `Web/` via GitHub Actions on push to `main` (see `.github/workflows/pages.yml`).

## Project layout

```
DiagramForge/
├── Web/           App (HTML + ES modules)
├── Samples/       Example .cde files
├── ICONs/         Cloud icon ZIP archives
└── tools/         Utilities (e.g. drawio2cde.py)
```

## Author

Satoru Ogura — with help from AIs.

## License

ISC
