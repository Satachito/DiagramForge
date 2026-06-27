# DiagramForge

Canvas-based diagram editor for **cloud architecture**, **mind maps**, and **sequence diagrams**.

**Live demo:** https://satachito.github.io/DiagramForge/

Open the page and start drawing — no build step for the hosted demo. Diagrams are plain JSON (`.cde` files), editable by hand or with AI in Cursor.

## Features

- **4096 × 4096 canvas** with pan/zoom
- **Shapes** — rect, ellipse, rhombus, SVG, PNG
- **Links** with arrowheads, anchor points, and orthogonal routing
- **Cloud icon palettes** — AWS, Azure, GCP (bundled ZIP archives)
- **Sample diagrams** — JSON primitives, cloud layouts, mind map, sequence chart
- **Import / export** — load and save `.cde` files (↑ / ↓ buttons)
- **Session restore** — last diagram is kept in `localStorage`
- **Light / dark mode** — follows system preference
- **AI editing** — dev server with live `.cde` reload, `window.DF` command API, and Cursor MCP for natural-language diagram changes (see **[USAGE.md](USAGE.md)**)

## Quick start (demo)

1. Open the [live demo](https://satachito.github.io/DiagramForge/).
2. Click a **Sample( … )** button on the right panel to load an example.
3. Drag on the canvas to move nodes; use the mode selector to create nodes and links.
4. Expand **GCP / Azure / AWS** in the left panel to place cloud icons.
5. Press **↓** to download the diagram as a `.cde` file.

## Local development & AI workflow

For editing in Cursor with **save → browser preview**, **live MCP control**, or chat commands like *“make the VPN band 1.2× taller”*:

```bash
cd Web && npm install && npm run dev
cd ../tools && npm install   # MCP (one-time)
```

Open `http://localhost:8080/?cde=Samples/JSONs.cde` and enable the **`diagramforge`** MCP server in Cursor (**Settings → Tools & MCP**).

Full setup, Phase 2/3/4 explanation, MCP tools, and troubleshooting: **[USAGE.md](USAGE.md)**

## `.cde` format

A saved `.cde` file is JSON:

```json
{
	"model": {
		"nodes": [],
		"links": []
	}
}
```

Each node is `[ ID, area, paint ]`. Each link is `[ [ fromID, toID ], ends, paint ]`.

Authoring rules for AI and hand edits: **[Web/SCHEMA.md](Web/SCHEMA.md)** · **[AI.md](AI.md)** (AI contract + MCP)  
Sample files: **[Samples/](Samples/)**

## Editing with Cursor

DiagramForge has no in-app AI panel. Typical workflows:

| Goal | How |
|------|-----|
| Edit `.cde` on disk, preview on save | Phase 2 — `npm run dev` + `?cde=Samples/….cde` |
| Change the open diagram from chat | Phase 4 — MCP (`df_get_model`, `df_apply`, …) |
| One-off file load on GitHub Pages | **↑** upload or a Sample button |

Tips:

- Prefer **rect / ellipse / rhombus** over new base64 icons unless you need a specific glyph.
- Keep **node IDs stable**; every link must reference existing IDs.
- Use samples as layout references — **[Samples/Sequence.cde](Samples/Sequence.cde)**, **[Samples/MindMap.cde](Samples/MindMap.cde)**, **[Samples/JSONs.cde](Samples/JSONs.cde)** for cloud architecture.

Cursor rules: **[Web/.cursorrules](Web/.cursorrules)**, **[Web/CLAUDE.md](Web/CLAUDE.md)** → `SCHEMA.md`.

## Run locally (static only)

No live reload or MCP — just preview the app:

```bash
cd Web
python3 -m http.server 8080
# http://localhost:8080/index.html
```

`Web/Samples` symlinks to `../Samples`. Icon ZIPs symlink from `ICONs/`.

## Lint & deploy

```bash
cd Web && npm run lint
```

GitHub Pages deploys from `Web/` on push to `main` (`.github/workflows/pages.yml`).

## Project layout

```
DiagramForge/
├── Web/              App (HTML + ES modules, ai-api.js)
├── Samples/          Example .cde files
├── ICONs/            Cloud icon ZIP archives
├── tools/            df-server, df-mcp, utilities
├── .cursor/mcp.json  Cursor MCP config
├── USAGE.md          Dev server + MCP workflow
├── AI.md             AI contract + MCP ops
└── Web/SCHEMA.md     .cde schema reference
```

## Author

Satoru Ogura — with help from AIs.

## License

ISC
