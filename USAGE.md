# Zukai — AI & dev workflow guide

This document summarizes how to edit diagrams with **Cursor, Claude, Codex**, the dev server, and MCP. For the `.zu` file format, see **[Web/SCHEMA.md](Web/SCHEMA.md)**.

**What is shared across clients:** Phase 2 (live reload), Phase 3 (HTTP/WebSocket), MCP tool names (`zu_status`, `zu_apply`, …), agent rules, and troubleshooting for the dev server / browser.

**What differs:** where you register the MCP server (Cursor settings vs Claude config vs Codex `config.toml`).

## Three layers (Phase 2 / 3 / 4)

| Layer | What it is | When it runs |
|-------|------------|--------------|
| **Phase 2 — live reload** | Save a `.zu` on disk → browser reloads that file | `watchPath` is set (see below) |
| **Phase 3 — WebSocket bridge** | `zu-server` RPCs into the open tab via `window.ZU` | `npm run dev` + browser tab open |
| **Phase 4 — MCP** | Chat agent calls MCP tools → Phase 3 → canvas | MCP enabled + same session as Phase 3 |

All three can be used together, or separately:

- **Edit `.zu` files, preview on save** → Phase 2 (`?zu=…`)
- **Script or curl changes the live canvas** → Phase 3 (`/__zu/rpc`)
- **Natural language in chat** → Phase 4 (`zu_apply`, etc.)

Phase 4 does **not** replace Phase 2. MCP changes the **in-memory** diagram until you call `zu_save_file`.

---

## One-time setup

```bash
cd Web && npm install
cd ../tools && npm install
```

### MCP server (all clients)

Every client runs the same stdio server:

| File | Role |
|------|------|
| **`tools/zu-mcp.mjs`** | MCP tools (`zu_status`, `zu_get_model`, …) |
| **`tools/zu-mcp-run.sh`** | Launcher — `cd`s into `tools/` so `node_modules` resolves |

The MCP process talks to **`zu-server`** (Phase 3) on port **8080** by default. If you use another port, set **`ZU_PORT`** in the MCP server's environment **and** when starting the dev server (see [Start the dev server](#start-the-dev-server-every-session)).

---

## Start the dev server (every session)

The MCP server (Phase 4) and the HTTP/WebSocket bridge (Phase 3) both connect to the **dev server**, so start it **before** registering or using any client:

```bash
cd Web
npm run dev
```

Leave a browser tab open on the dev server (see [Which URL to open](#which-url-to-open)).

---

## Register your MCP client

Pick your client below. Replace **`/path/to/Zukai`** with your clone path (Claude Desktop requires absolute paths).

---

### Cursor

1. Open this repo at **`Zukai/`** (project root, not `Web/` alone).
2. **Settings → Tools & MCP** (or **Customize**): find **`zukai`** under **Workspace MCP Servers**.
3. Turn the toggle **ON** (Enabled).
4. If it does not appear: **Cmd+Q** to quit Cursor completely, reopen, or **Cmd+Shift+P → Developer: Reload Window**.

Config file: **[`.cursor/mcp.json`](.cursor/mcp.json)** (uses `tools/zu-mcp-run.sh`).

---

### Claude Desktop

1. **Settings → Developer → Edit Config** (creates/opens `claude_desktop_config.json`).
2. Add a `zukai` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "zukai": {
      "command": "/bin/bash",
      "args": ["/path/to/Zukai/tools/zu-mcp-run.sh"],
      "env": {
        "ZU_PORT": "8080"
      }
    }
  }
}
```

3. **Fully quit** Claude Desktop (**Cmd+Q** on macOS) and reopen — closing the window is not enough.

Config file locations:

| OS | Path |
|----|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

In chat, MCP tools appear when the hammer/tools icon shows servers connected. Ask: *Run `zu_status`.*

---

### Claude Code (CLI)

From the **repo root** (project scope — shareable via git):

```bash
claude mcp add zukai --scope project --env ZU_PORT=8080 -- /bin/bash tools/zu-mcp-run.sh
```

Or add the same block to **`.mcp.json`** at the project root (Claude Code's project config — separate from `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "zukai": {
      "command": "/bin/bash",
      "args": ["/path/to/Zukai/tools/zu-mcp-run.sh"],
      "env": {
        "ZU_PORT": "8080"
      }
    }
  }
}
```

First use may prompt to **approve** project-scoped servers. Verify:

```bash
claude mcp list
```

Then in a session: *Run `zu_status`.*

---

### OpenAI Codex (CLI / IDE extension)

Codex uses **TOML**, not JSON. Global config: **`~/.codex/config.toml`**. Project override (trusted projects): **`.codex/config.toml`**.

**CLI** (from anywhere):

```bash
codex mcp add zukai --env ZU_PORT=8080 -- /bin/bash /path/to/Zukai/tools/zu-mcp-run.sh
```

**Or edit `~/.codex/config.toml`:**

```toml
[mcp_servers.zukai]
command = "/bin/bash"
args = ["/path/to/Zukai/tools/zu-mcp-run.sh"]
enabled = true
startup_timeout_sec = 30

[mcp_servers.zukai.env]
ZU_PORT = "8080"
```

Verify:

```bash
codex mcp list
```

Inside a Codex session, **`/mcp`** shows server status. Then ask: *Run `zu_status`.*

Docs: [OpenAI Codex — MCP](https://developers.openai.com/codex/mcp).

---

## Which URL to open

| URL | Phase 2 (auto-reload on save) | Phase 3 / 4 (live MCP) |
|-----|------------------------------|-------------------------|
| `http://localhost:8080/?zu=Samples/JSONs.zu` | **Yes** — watches that file | **Yes** |
| `http://localhost:8080/` | **No** (unless `zu-watch` left in sessionStorage) | **Yes** |
| Sample button in the app | **Yes** — sets watch path | **Yes** |

**Recommended for file + AI editing:** use `?zu=Samples/YourDiagram.zu`.

**MCP-only experiments:** `http://localhost:8080/` is fine; live edits apply to whatever is on the canvas (localStorage restore or empty diagram). They are **not** written to disk until `zu_save_file`.

To clear a stale watch path: DevTools → Application → Session Storage → delete `zu-watch`, or upload a file with **↑** (upload clears the watch).

---

## Phase 2 — edit `.zu`, see it in the browser

1. `npm run dev`
2. Open `http://localhost:8080/?zu=Samples/JSONs.zu`
3. Edit `Samples/JSONs.zu` in your editor and **save**
4. The browser reloads that file (pan/zoom/selection are not preserved)

Port already in use:

```bash
lsof -ti:8080 | xargs kill
# or: ZU_PORT=8081 npm run dev
```

---

## Phase 3 — HTTP / WebSocket bridge

Requires a connected browser tab (`zu_status` → `"connected": true`).

```bash
# Connection check
curl -s http://127.0.0.1:8080/__zu/status

# Read live model
curl -s http://127.0.0.1:8080/__zu/model

# Apply ops (example: change VPN rV live, no file save)
node --input-type=module -e "
const snap = await (await fetch('http://127.0.0.1:8080/__zu/model')).json();
const vpn = snap.model.nodes.find(n => n[0] === 'VPN');
const area = { ...vpn[1], rV: 86 };
await fetch('http://127.0.0.1:8080/__zu/rpc', {
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
| GET | `/__zu/status` | Browser connected? watch path, node count |
| GET | `/__zu/model` | Live `{ model, canvas: { width, height } }` |
| POST | `/__zu/rpc` | Body: `{ "method": "apply", "params": { "ops": […] } }` |

DevTools: `window.ZU` in the browser — see **`Web/ai-api.js`** and **[Web/SCHEMA.md](Web/SCHEMA.md)**.

---

## Phase 4 — MCP from chat (Cursor / Claude / Codex)

**Prerequisites:** `npm run dev`, browser tab open, **`zukai` MCP registered and enabled** in your client (see [MCP setup](#mcp-server-all-clients)).

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
| **Cursor:** `zukai` not in MCP list | Open repo root; Reload Window or quit Cursor (Cmd+Q) |
| **Cursor:** MCP listed but Disabled | Toggle **ON** in Settings → Tools & MCP |
| **Claude Desktop:** server missing | Check JSON syntax; use **absolute** path to `zu-mcp-run.sh`; fully quit app (Cmd+Q) |
| **Claude Code:** server not loaded | `claude mcp list`; approve project servers; restart session |
| **Codex:** server not loaded | `codex mcp list` or `/mcp`; check `~/.codex/config.toml` |
| `connected: false` | Open dev URL in browser; keep tab open |
| RPC timeout | Restart `npm run dev`; increase Codex `startup_timeout_sec` if needed |
| Phase 2 not reloading | Use `?zu=…` or Sample button; check `zu-watch` in sessionStorage |
| `DrawModel failed` + `atob` | Corrupt SVG/PNG on a node — fix via `zu_get_model` / file |
| Port 8080 in use | `lsof -ti:8080 \| xargs kill` or `ZU_PORT=8081 npm run dev` (+ set `ZU_PORT` in MCP env) |

---

## Project layout (dev / AI)

```
Zukai/
├── Web/              App + ai-api.js (window.ZU)
├── Samples/          Example .zu files
├── tools/
│   zu-server.mjs     Dev server + bridge
│   zu-mcp.mjs        MCP server (stdio)
│   zu-mcp-run.sh     MCP launcher (all clients)
├── .cursor/mcp.json  Cursor workspace MCP config
└── .mcp.json         (optional) Claude Code project MCP config
```
