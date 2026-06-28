# Zukai — AI & dev workflow guide

This document summarizes how to edit diagrams with Cursor, the dev server, and MCP. For the `.zu` file format, see **[Web/SCHEMA.md](Web/SCHEMA.md)**.

## Three layers (Phase 2 / 3 / 4)

| Layer | What it is | When it runs |
|-------|------------|--------------|
| **Phase 2 — live reload** | Save a `.zu` on disk → browser reloads that file | `watchPath` is set (see below) |
| **Phase 3 — WebSocket bridge** | `zu-server` RPCs into the open tab via `window.DF` | `npm run dev` + browser tab open |
| **Phase 4 — MCP** | Cursor chat calls MCP tools → Phase 3 → canvas | MCP enabled + same session as Phase 3 |

All three can be used together, or separately:

- **Edit files in Cursor, preview on save** → Phase 2 (`?zu=…`)
- **Script or curl changes the live canvas** → Phase 3 (`/__df/rpc`)
- **Natural language in Cursor chat** → Phase 4 (`zu_apply`, etc.)

Phase 4 does **not** replace Phase 2. MCP changes the **in-memory** diagram until you call `zu_save_file`.

---

## One-time setup

```bash
cd Web && npm install
cd ../tools && npm install
```

### Enable MCP in Cursor

1. Open this repo at **`Zukai/`** (project root, not `Web/` alone).
2. **Settings → Tools & MCP** (or **Customize**): find **`zukai`** under **Workspace MCP Servers**.
3. Turn the toggle **ON** (Enabled).
4. If it does not appear: **Cmd+Q** to quit Cursor completely, reopen, or **Cmd+Shift+P → Developer: Reload Window**.

Config file: **[`.cursor/mcp.json`](.cursor/mcp.json)** (uses `tools/zu-mcp-run.sh`).

---

## Every session

```bash
cd Web
npm run dev
```

Leave a browser tab open on the dev server.

---

## Which URL to open

| URL | Phase 2 (auto-reload on save) | Phase 3 / 4 (live MCP) |
|-----|------------------------------|-------------------------|
| `http://localhost:8080/?zu=Samples/JSONs.zu` | **Yes** — watches that file | **Yes** |
| `http://localhost:8080/` | **No** (unless `df-watch` left in sessionStorage) | **Yes** |
| Sample button in the app | **Yes** — sets watch path | **Yes** |

**Recommended for file + AI editing:** use `?zu=Samples/YourDiagram.zu`.

**MCP-only experiments:** `http://localhost:8080/` is fine; live edits apply to whatever is on the canvas (localStorage restore or empty diagram). They are **not** written to disk until `zu_save_file`.

To clear a stale watch path: DevTools → Application → Session Storage → delete `df-watch`, or upload a file with **↑** (upload clears the watch).

---

## Phase 2 — edit `.zu`, see it in the browser

1. `npm run dev`
2. Open `http://localhost:8080/?zu=Samples/JSONs.zu`
3. Edit `Samples/JSONs.zu` in Cursor and **save**
4. The browser reloads that file (pan/zoom/selection are not preserved)

Port already in use:

```bash
lsof -ti:8080 | xargs kill
# or: DF_PORT=8081 npm run dev
```

---

## Phase 3 — HTTP / WebSocket bridge

Requires a connected browser tab (`zu_status` → `"connected": true`).

```bash
# Connection check
curl -s http://127.0.0.1:8080/__df/status

# Read live model
curl -s http://127.0.0.1:8080/__df/model

# Apply ops (example: change VPN rV live, no file save)
node --input-type=module -e "
const snap = await (await fetch('http://127.0.0.1:8080/__df/model')).json();
const vpn = snap.model.nodes.find(n => n[0] === 'VPN');
const area = { ...vpn[1], rV: 86 };
await fetch('http://127.0.0.1:8080/__df/rpc', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'apply',
    params: { ops: [{ op: 'updateNode', id: 'VPN', area, paint: vpn[2] }] }
  })
});
"
```

Endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/__df/status` | Browser connected? watch path, node count |
| GET | `/__df/model` | Live `{ model, canvas: { width, height } }` |
| POST | `/__df/rpc` | Body: `{ "method": "apply", "params": { "ops": […] } }` |

DevTools: `window.DF` in the browser — see **`Web/ai-api.js`** and **[Web/SCHEMA.md](Web/SCHEMA.md)**.

---

## Phase 4 — MCP from Cursor chat

**Prerequisites:** `npm run dev`, browser tab open, **`zukai` MCP enabled**.

### Check connection

Ask in chat:

> Run `zu_status`.

Expect `"connected": true` and a `watchPath` if you opened with `?zu=…`.

### Example — resize a band (no save)

> Make the VPN vertical size 1.2×. Use MCP. Do not save to disk.

Typical agent steps:

1. `zu_get_model` — read node `"VPN"`, get `rV`, `cY`, `style`
2. `zu_apply` — `updateNode` with **full** `area` and `paint` (not a partial patch)
3. Adjust neighbouring nodes if layout must stay flush

### Example — persist

> Save the current diagram to `Samples/JSONs.zu`.

Calls `zu_save_file`. Phase 2 may then reload the tab when the file is written.

### MCP tools

| Tool | Purpose |
|------|---------|
| `zu_status` | Connection and watch path |
| `zu_get_model` | Live diagram snapshot |
| `zu_apply` | Apply ops (`updateNode`, `addLink`, …) |
| `zu_validate` | Validate live or given model |
| `zu_auto_layout` | Grid layout |
| `zu_load_file` | Load `.zu` into browser (path under `Web/`) |
| `zu_save_file` | Write live diagram to disk |
| `zu_read_file` | Read `.zu` from disk (no browser needed) |

### Rules for agents

- **`updateNode` replaces** the whole `area` / `paint`. Read the node first, then change fields.
- **SVG / PNG nodes:** copy `SVG` / `PNG` base64 **exactly** from `zu_get_model` or the file. A single typo breaks `atob()` and drawing fails.
- **Layout bands** (VPN, Internet, etc.): changing `rV` often requires updating `cY` and nodes below to avoid overlap.
- **Undo:** live MCP edits go through `Application.js` and are undoable in the browser (Ctrl/Cmd+Z).

---

## Quick troubleshooting

| Problem | Fix |
|---------|-----|
| `zukai` not in MCP list | Open repo root; Reload Window or quit Cursor (Cmd+Q) |
| MCP listed but Disabled | Toggle **ON** in Settings → Tools & MCP |
| `connected: false` | Open dev URL in browser; keep tab open |
| RPC timeout | Restart `npm run dev` |
| Phase 2 not reloading | Use `?zu=…` or Sample button; check `df-watch` in sessionStorage |
| `DrawModel failed` + `atob` | Corrupt SVG/PNG on a node — fix via `zu_get_model` / file |
| Port 8080 in use | `lsof -ti:8080 \| xargs kill` |

---

## Project layout (dev / AI)

```
Zukai/
├── Web/              App + ai-api.js (window.DF)
├── Samples/          Example .zu files
├── tools/
│   zu-server.mjs     Dev server + bridge
│   zu-mcp.mjs        MCP server (stdio)
│   zu-mcp-run.sh     MCP launcher for Cursor
└── .cursor/mcp.json  Workspace MCP config
```
