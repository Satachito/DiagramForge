# Zukai `.zu` schema

A `.zu` file is the JSON of the diagram model, tab-indented:

```json
{ "model": { "nodes": [ ... ], "links": [ ... ] } }
```

`index.html` loads it via the `↑` upload button, and the last session is
auto-restored from `localStorage` (`tokyo.828.zukai`). The canvas origin
is top-left with the **y axis pointing down**.

Canvas size is **not** stored in `.zu`. On load, it is derived from the nodes'
bounding box (with margin, snapped to 256 px); an empty diagram uses **4096 × 4096**.
At runtime the `<canvas>` element is the source of truth; manual resizes persist
in `localStorage` (`tokyo.828.zukai.canvas`) for the session.

## Node

```
[ ID, shape, paint ]
```

- **`ID`** — unique string. Links reference nodes by this ID.
- **`shape`** — geometry + content:
  - `type` — `"rect"` | `"ellipse"` | `"rhombus"` | `"SVG"` | `"PNG"`
  - `cX`, `cY` — center (numbers)
  - `rH`, `rV` — half-width / half-height. The shape spans
    `[cX - rH, cY - rV]` to `[cX + rH, cY + rV]`.
  - `radii` — corner radius, `rect` only (number, optional)
  - `html` — optional HTML label rendered centered inside the shape
  - `style` — optional CSS for the label container (e.g. `;display: grid\n;place-items: center`)
  - `SVG` / `PNG` — base64 image bytes; **required** when `type` is `"SVG"` / `"PNG"`
- **`paint`** — Canvas 2D fill/stroke. Any omitted/empty key is simply not applied:
  - `fill`, `stroke` — CSS colors
  - `lineWidth`, `lineCap`, `lineJoin`, `miterLimit`
  - `lineDash`, `lineDashOffset`

Example:

```json
[ "Cloud",
  { "type": "rect", "cX": 960, "cY": 336, "rH": 384, "rV": 176,
    "radii": 18, "html": "Cloud", "style": ";font-weight : 700" },
  { "stroke": "gray", "lineWidth": 2 } ]
```

## Link

```
[ [ fromID, toID ], attributes, paint ]
```

- **`fromID` / `toID`** — must reference existing node IDs.
- **`attributes`**:
  - `headF`, `headT` — arrowhead at the from / to end. Use `false` (or omit)
    for none, or one of the styles:
    - `"triangle"` — filled triangle (default)
    - `"open"` — open V (line only); pairs well with a dashed shaft
    - `"hollow"` — outlined triangle
    - `"diamond"` / `"diamondHollow"` — filled / outlined diamond
    - `"circle"` / `"circleHollow"` — filled / outlined disc

    Filled heads use `paint.fill ?? paint.stroke`; outlined / open heads use
    `paint.stroke`. The head tip sits on the node boundary and its size scales
    with the link length.
  - `anchorF`, `anchorT` — where the link attaches on each node:
    - `"T"` / `"B"` / `"L"` / `"R"` — the **midpoint** of that edge
    - `"TL"` / `"TR"` / `"BL"` / `"BR"` — that **corner**
    - omit (auto) — the point where the ray toward the **other node's center**
      crosses this node's outline

    On an `ellipse` / `rhombus`, an anchored point is projected onto the actual
    curved / diagonal outline (a `rect`/`SVG`/`PNG` keeps the box point). The
    perpendicular H/V snap described under `"straight"` below applies only to
    `rect` / `SVG` / `PNG` ends, not to `ellipse` / `rhombus`.
  - `corner` — shaft routing / corner style. Every style **except** `"straight"`
    routes the link **orthogonally** (right-angle bends), whatever its anchors;
    the style only changes how that multi-point shaft is drawn:
    - `"bezier"` — smooth Bézier that leaves each node perpendicular and rounds
      the corners (default)
    - `"sharp"` — polyline with right-angle corners (orthogonal)
    - `"arc"` — straight runs joined by quarter-circle fillets
    - `"straight"` — a direct 2-point line instead of the orthogonal route. With
      exactly one end anchored, the auto end attaches *perpendicular* to the
      anchored edge, so the line snaps to horizontal / vertical when the ends
      line up. (This perpendicular snap happens **only** with `"straight"`.)
- **`paint`** — same shape as node `paint`.

Example:

```json
[ [ "Core Data", "Analysis" ], { "headF": false, "headT": "triangle" },
  { "stroke": "gray", "lineWidth": 2 } ]
```

## Authoring rules (for AI edits)

- **Prefer `rect` / `ellipse` / `rhombus`.** They are tiny vector primitives.
  Do not embed new `SVG` / `PNG` base64 unless explicitly asked — it bloats the
  file and the edit context.
- **Never rewrite the base64 of an existing `SVG` / `PNG` node.** Move or resize
  it by editing `cX/cY/rH/rV` only, and keep its `ID` and `type`.
- **Keep IDs stable.** Preserve existing IDs, links, and coordinates unless the
  request asks to change them. New nodes get fresh unique string IDs.
- **Every link must reference existing node IDs.** Place new nodes near related
  ones and keep the diagram readable (within the canvas bounds).
