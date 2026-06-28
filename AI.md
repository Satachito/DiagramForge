# Zukai AI contract — `.zu` and live editing

Implementation-accurate contract for agents (Cursor, MCP, scripts) working on Zukai.

| Document | Role |
|----------|------|
| **This file (AI.md)** | AI contract, MCP / `window.DF` operations |
| **[Web/SCHEMA.md](Web/SCHEMA.md)** | `.zu` schema detail (link `corner`, anchors, examples) |
| **[USAGE.md](USAGE.md)** | Dev server, Phase 2/3/4, MCP setup |

**Early-development policy:** no legacy field normalization or compatibility shims. Invalid JSON fails at load or validation so drift is visible.

---

## Root object (`.zu` file)

```json
{
	"model": {
		"nodes": [ … ],
		"links": [ … ]
	}
}
```

| Field | Description |
|-------|-------------|
| **`model.nodes`** | Node array (draw order ≈ z-order; later entries on top) |
| **`model.links`** | Link array |

Coordinate system: origin top-left, **Y axis downward**.

`.zu` holds diagram content only. Canvas size is derived on load from the node
bounding box (empty diagram → 4096×4096). At runtime the `<canvas>` element is
the source of truth; live MCP/API responses may include current canvas dimensions
separately from the file format.

---

## Node `[ ID, shape, paint ]`

| index | Name | Content |
|-------|------|---------|
| `0` | **`ID`** | Unique string. Links reference nodes by ID |
| `1` | **`shape`** | Geometry + label (table below) |
| `2` | **`paint`** | Canvas 2D style (optional `{}`) |

### `shape`

| Field | Required | Description |
|-------|----------|-------------|
| **`type`** | ✓ | `"rect"` \| `"ellipse"` \| `"rhombus"` \| `"SVG"` \| `"PNG"` |
| **`cX`, `cY`** | ✓ | Center (numbers). **Not** `cx`/`cy` |
| **`rH`, `rV`** | ✓ | Half-width / half-height. Size ≈ `2×|rH|` × `2×|rV|` |
| **`radii`** | — | Corner radius for `rect` |
| **`html`** | — | Label HTML (`foreignObject`). **Not** `innerHTML` |
| **`style`** | — | Label CSS fragments (`;prop : value`, newline-separated) |
| **`SVG`** | when type=SVG | SVG source string (encoded to base64 at draw time) |
| **`PNG`** | when type=PNG | PNG base64 |

Geometry: `x = cX − rH`, `y = cY − rV`, `width = 2×rH`, `height = 2×rV`.

### `paint` (nodes and links)

Recognized keys: `fill`, `stroke`, `lineWidth`, `lineCap`, `lineJoin`, `miterLimit`, `lineDash`, `lineDashOffset`.

---

## Link `[ [ fromID, toID ], attributes, paint ]`

| index | Name | Content |
|-------|------|---------|
| `0` | **Endpoints** | `[ fromID, toID ]` strings |
| `1` | **`attributes`** | Arrowheads, anchors, routing (below) |
| `2` | **`paint`** | Line style |

**Do not use** legacy `[ A, B, direction, paint ]` or `direction: "<>"`.

### `attributes`

| Key | Values | Description |
|-----|--------|-------------|
| **`headF`, `headT`** | `false` / omit / style name | Arrow at from / to end. Styles: `triangle`, `open`, `hollow`, `diamond`, `diamondHollow`, `circle`, `circleHollow` |
| **`anchorF`, `anchorT`** | `T` `B` `L` `R` `TL` `TR` `BL` `BR` / omit | Attachment point. Omit = outline hit toward the other node's center |
| **`corner`** | `bezier` (default) / `sharp` / `arc` / `straight` | Orthogonal routing and corner drawing — see SCHEMA.md |

Duplicate `[ from, to ]` pairs are merged by `Link()` / `EditLink()`. Avoid duplicates (`validate` reports them).

---

## Authoring rules (files and agents)

1. **Prefer `rect` / `ellipse` / `rhombus`.** New base64 icons only when explicitly requested.
2. **Never rewrite existing `SVG` / `PNG` payload.** Move/resize via `cX`/`cY`/`rH`/`rV` and stable `ID` only.
3. **Keep node IDs stable.** Every link must reference existing IDs.
4. **Band layouts** (VPN, Internet, …): changing `rV` often requires updating **`cY` and nodes below** to stay flush with neighbours.
5. **`updateNode` (API) replaces the full `shape` / `paint`.** Not a patch — read current state first.

---

## Validation (`validateModel` / `zu_validate`)

Same rules in `Web/ai-api.js` and `tools/zu-validate.mjs`:

- Node: `[ ID, shape, paint? ]`, non-empty unique `ID`, `type` set, finite `cX`/`cY`/`rH`/`rV`, width and height > 5px
- Link: `[ [ from, to ], attrs?, paint? ]`, endpoints exist, no self-links or duplicate pairs

---

## Programmatic API

### Browser — `window.DF` (`Web/ai-api.js`)

Via `Application.js`: **one operation = one undo step**.

```js
DF.getModel()           // clone of { nodes, links }
DF.validate(model?)     // array of issue strings (empty = OK)
DF.apply([ { op: '…', … }, … ])
DF.autoLayout({ algorithm: 'grid', cols, gap, startX, startY })
DF.setModel({ nodes, links })
```

**`apply` ops:**

| op | Main arguments |
|----|----------------|
| `addNode` | `id`, `area`, `paint?` |
| `updateNode` | `id`, `area`, `paint?`, `newId?` |
| `removeNode` | `id` |
| `restack` | `id`, `toFront?` |
| `addLink` | `from`, `to`, `ends?`, `paint?` |
| `updateLink` | `from`, `to`, `newFrom?`, `newTo?`, `ends?`, `paint?` |
| `removeLink` | `from`, `to` |
| `autoLayout` | grid options |
| `setCanvas` | `width`, `height` |

`area` = **`shape`** object above. `ends` = link **`attributes`**.

### MCP — `zukai` server (`tools/zu-mcp.mjs`)

| Tool | Purpose |
|------|---------|
| `zu_status` | Browser connection, `watchPath` |
| `zu_get_model` | Live `{ model, canvas: { width, height } }` |
| `zu_apply` | `{ ops: [ … ] }` — same ops as above |
| `zu_validate` | Validation |
| `zu_auto_layout` | Grid layout |
| `zu_load_file` / `zu_save_file` | Load into browser / save to disk (path under `Web/`) |
| `zu_read_file` | Read from disk (no browser) |

**Requires:** `npm run dev`, open browser tab, **`zukai` MCP enabled**. See [USAGE.md](USAGE.md).

### HTTP bridge (Phase 3)

Provided by `tools/zu-server.mjs`:

- `GET /__df/status`
- `GET /__df/model`
- `POST /__df/rpc` — e.g. `{ "method": "apply", "params": { "ops": […] } }`

---

## Which path to use

| Goal | Path |
|------|------|
| Save `.zu` → browser updates | Phase 2 — `?zu=Samples/….zu` + file save |
| Change live diagram from chat | Phase 4 — MCP `zu_apply` |
| Script / curl | Phase 3 — `/__df/rpc` |
| GitHub Pages only | Hand-edit `.zu` + **↑** upload |

Phase 4 changes stay **in memory** until `zu_save_file`.

---

## Related code

| File | Role |
|------|------|
| `Web/Application.js` | `Load`, `Node`, `EditNode`, `Link`, `SetModel`, undo |
| `Web/ai-api.js` | `window.DF`, `validateModel`, `apply` |
| `Web/geoDF.js` | Link routing, arrowheads, frame offsets |
| `Web/main-editor.js` | Drawing, context menus |
| `Web/ForeignLabel.js` | `html` labels |
| `tools/zu-server.mjs` | Static serve + live reload + RPC |
| `tools/zu-mcp.mjs` | Cursor MCP |
| `tools/zu-validate.mjs` | File / MCP validation |

---

## Obsolete (do not use)

Not supported by the current implementation — fix files manually if present:

- Root `{ nodes, links }` only (no `model` wrapper) — load expects `{ model }`
- Coordinates `cx`/`cy`, `innerHTML`, `div` node type
- Links `[ A, B, direction, paint ]`, `direction: "<>"` / `"<"` / `">"`
- `PATH` node type, `yellow` paint key (unused in drawing)
