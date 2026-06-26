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

The app is static files under `Web/`. For a quick one-off preview:

```bash
cd Web
python3 -m http.server 8080
# http://localhost:8080/index.html
```

`Web/Samples` is a symlink to `../Samples`. Icon ZIPs are symlinked from `ICONs/`.

## Development (live reload + AI API)

For day-to-day editing — especially **`.cde` files in Cursor with the browser open beside it** — use the dev server. It serves `Web/`, watches `Samples/*.cde`, and pushes reload events over WebSocket so the open diagram refreshes when you save.

### Setup

```bash
cd Web
npm install
npm run dev
```

Open a sample (or any repo-relative path under `Web/`):

```
http://localhost:8080/?cde=Samples/JSONs.cde
```

### Workflow

1. Start `npm run dev` and open a diagram with `?cde=…` (or click a **Sample( … )** button — that path is watched too).
2. Edit the `.cde` file in your editor and **save**.
3. The browser reloads that file in place; pan/zoom and selection are not preserved, but you see layout changes immediately.
4. Use **↑ / ↓** in the app for one-off uploads and downloads. Uploading a local file clears the watch path (no auto-reload until you load a server path again).

**Port in use?** Another `df-server` may still be running:

```bash
lsof -ti:8080 | xargs kill
# or: PORT=8081 npm run dev
```

### `window.DF` — in-browser command API

When the app is open, the live model is exposed as **`window.DF`** (`Web/ai-api.js`). Each call goes through `Application.js`, so edits are undoable and the canvas redraws.

Try in DevTools console:

```js
DF.getModel()                          // current { nodes, links }
DF.validate()                          // [] if OK, else error strings
DF.apply([
  { op: 'addNode', id: 'Box', area: { type: 'rect', cX: 400, cY: 300, rH: 80, rV: 40, html: 'Hi' } },
  { op: 'addLink', from: 'Box', to: 'Core Data' }
])
DF.autoLayout({ algorithm: 'grid', cols: 4 })
```

| Method | Purpose |
|--------|---------|
| `getModel()` | Clone of `{ nodes, links }` |
| `setModel(model)` | Replace the whole diagram |
| `validate(model?)` | Schema / ID checks |
| `apply(ops)` | Run ops sequentially (see below) |
| `autoLayout({ algorithm, cols, gap, startX, startY })` | Grid layout (`algorithm: 'grid'`) |

**Ops** for `apply()` (and also on `DF` directly): `addNode`, `updateNode`, `removeNode`, `restack`, `addLink`, `updateLink`, `removeLink`, `autoLayout`, `setCanvas`.

External agents (Cursor, MCP bridge, CDP) can call these from the browser context. File-based editing still uses **[Web/SCHEMA.md](Web/SCHEMA.md)**; live reload connects the two.

### MCP — natural language control from Cursor

With the dev server running and a diagram open in the browser, Cursor can drive the **live canvas** through the **DiagramForge MCP server** (`tools/df-mcp.mjs`). Say things like *“make the VPN band 1.5× taller”* — the agent calls MCP tools, which RPC into the browser via `window.DF`.

**One-time setup:**

```bash
cd Web && npm install          # dev server
cd ../tools && npm install     # MCP server deps
```

The repo includes **[`.cursor/mcp.json`](.cursor/mcp.json)**. Reload Cursor (or enable the `diagramforge` MCP server in settings) after installing.

**Every session:**

1. `cd Web && npm run dev`
2. Open `http://localhost:8080/?cde=Samples/JSONs.cde` in a browser tab and leave it open.
3. In Cursor chat, ask for diagram changes. The agent uses MCP tools such as:

| Tool | What it does |
|------|----------------|
| `df_status` | Is a browser editor connected? Which `.cde` is watched? |
| `df_get_model` | Read `{ model, canvasWidth, canvasHeight }` from the live diagram |
| `df_apply` | Apply ops (`updateNode`, `addLink`, …) — same shape as `DF.apply()` |
| `df_validate` | Check the live model or a provided model |
| `df_auto_layout` | Grid layout on the live diagram |
| `df_save_file` | Write the live diagram to `Web/Samples/….cde` |
| `df_load_file` | Load a `.cde` path into the browser |
| `df_read_file` | Read a `.cde` from disk (works without a browser) |

**Example flow** (*“VPN vertical size ×1.5”*):

1. `df_get_model` → find node `"VPN"`, read `rV`
2. `df_apply` with `updateNode` (merge the full `area` object; `updateNode` replaces the shape, it does not patch fields)
3. Optionally adjust neighbours and `df_save_file` to persist

`updateNode` needs the complete `area` and `paint` — the agent should read the node first, change numbers, then apply.

**HTTP bridge** (for scripts): `GET /__df/status`, `GET /__df/model`, `POST /__df/rpc` with `{ "method": "apply", "params": { "ops": […] } }`.

### Lint

```bash
cd Web
npm run lint
```

GitHub Pages deploys from `Web/` via GitHub Actions on push to `main` (see `.github/workflows/pages.yml`).

## Project layout

```
DiagramForge/
├── Web/           App (HTML + ES modules)
├── Samples/       Example .cde files
├── ICONs/         Cloud icon ZIP archives
├── tools/         Dev server, MCP server, utilities ( drawio2cde.py )
```

## Author

Satoru Ogura — with help from AIs.

## License

ISC
