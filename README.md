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

## Editing with Cursor or Claude

DiagramForge has no in-app AI panel. The intended workflow is to **create and edit `.cde` files in your editor or with an AI assistant**, then load them in the browser (↑ or a Sample button).

1. Open this repo in **Cursor** or **Claude Code** (or any editor).
2. Read **[Web/SCHEMA.md](Web/SCHEMA.md)** — node/link shape, paint fields, and rules for safe edits (especially for AI).
3. Start from a sample in **[Samples/](Samples/)** or ask the model to produce a new `.cde` from a description (e.g. “AWS 3-tier web app”, “mind map about learning Spanish”, “checkout sequence diagram”).
4. Save the file, load it in the [demo](https://satachito.github.io/DiagramForge/) with **↑**, and iterate.

Tips for AI edits:

- Prefer **rect / ellipse / rhombus** over embedding new base64 icons unless you need a specific cloud glyph.
- Keep **node IDs stable**; every link must reference existing IDs.
- Use the samples as style and layout references — **[Samples/Sequence.cde](Samples/Sequence.cde)** for sequence charts, **[Samples/MindMap.cde](Samples/MindMap.cde)** for mind maps, cloud samples for architecture diagrams.

In Cursor, project rules in **[Web/.cursorrules](Web/.cursorrules)** and **[Web/CLAUDE.md](Web/CLAUDE.md)** point agents at `SCHEMA.md` automatically.

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
