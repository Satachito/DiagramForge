# Zukai

Canvas-based diagram editor for **cloud architecture**, **mind maps**, and **sequence diagrams**.

**Live demo:** https://satachito.github.io/Zukai/

Open the page and start drawing — no build step for the hosted demo. Diagrams are plain JSON (`.zu` files), editable by hand or with AI in Cursor.

## Features

- **4096 × 4096 canvas** with pan/zoom
- **Shapes** — rect, ellipse, rhombus, SVG, PNG
- **Links** with arrowheads, anchor points, and orthogonal routing
- **Cloud icon palettes** — AWS, Azure, GCP (bundled ZIP archives)
- **Sample diagrams** — JSON primitives, cloud layouts, mind map, sequence chart
- **Import / export** — load and save `.zu` files (↑ / ↓ buttons)
- **Session restore** — last diagram is kept in `localStorage`
- **Light / dark mode** — follows system preference
- **AI editing** — dev server with live `.zu` reload, `window.DF` command API, and Cursor MCP for natural-language diagram changes (see **[USAGE.md](USAGE.md)**)

## Quick start (demo)

1. Open the [live demo](https://satachito.github.io/Zukai/).
2. Click a **Sample( … )** button on the right panel to load an example.
3. Drag on the canvas to move nodes; use the mode selector to create nodes and links.
4. Expand **GCP / Azure / AWS** in the left panel to place cloud icons.
5. Press **↓** to download the diagram as a `.zu` file.

## Local development & AI workflow

For editing in Cursor with **save → browser preview**, **live MCP control**, or chat commands like *“make the VPN band 1.2× taller”*:

```bash
cd Web && npm install && npm run dev
cd ../tools && npm install   # MCP (one-time)
```

Open `http://localhost:8080/?zu=Samples/JSONs.zu` and enable the **`diagramforge`** MCP server in Cursor (**Settings → Tools & MCP**).

Full setup, Phase 2/3/4 explanation, MCP tools, and troubleshooting: **[USAGE.md](USAGE.md)**

## `.zu` format

A saved `.zu` file is JSON:

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

Zukai has no in-app AI panel. Typical workflows:

| Goal | How |
|------|-----|
| Edit `.zu` on disk, preview on save | Phase 2 — `npm run dev` + `?zu=Samples/….zu` |
| Change the open diagram from chat | Phase 4 — MCP (`df_get_model`, `df_apply`, …) |
| One-off file load on GitHub Pages | **↑** upload or a Sample button |

Tips:

- Prefer **rect / ellipse / rhombus** over new base64 icons unless you need a specific glyph.
- Keep **node IDs stable**; every link must reference existing IDs.
- Use samples as layout references — **[Samples/Sequence.zu](Samples/Sequence.zu)**, **[Samples/MindMap.zu](Samples/MindMap.zu)**, **[Samples/JSONs.zu](Samples/JSONs.zu)** for cloud architecture.

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
Zukai/
├── Web/              App (HTML + ES modules, ai-api.js)
├── Samples/          Example .zu files
├── ICONs/            Cloud icon ZIP archives
├── tools/            df-server, df-mcp, utilities
├── .cursor/mcp.json  Cursor MCP config
├── USAGE.md          Dev server + MCP workflow
├── AI.md             AI contract + MCP ops
└── Web/SCHEMA.md     .zu schema reference
```

## Author

Satoru Ogura — with help from AIs.

## License

ISC
