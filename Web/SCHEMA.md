# DiagramForge `.cde` schema

A `.cde` file is the JSON of the diagram model, tab-indented:

```json
{ "model": { "nodes": [ ... ], "links": [ ... ] },
  "canvasWidth": 4096, "canvasHeight": 4096 }
```

`index.html` loads it via the `↑` upload button, and the last session is
auto-restored from `localStorage` (`tokyo.828.diagramforge`). The canvas origin
is top-left with the **y axis pointing down**.

- **`canvasWidth` / `canvasHeight`** — top-level (siblings of `model`), optional.
  Files saved or exported from the editor include the current canvas size here.
  When omitted (e.g. hand-written samples) the canvas size is derived from the
  nodes' bounding box on load; with no nodes either, it defaults to
  **4096 × 4096** pixels.

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
    one of `"T"`, `"L"`, `"B"`, `"R"`, `"TL"`, `"TR"`, `"BL"`, `"BR"`,
    or omit (auto: points at the other node's center). With exactly one end
    anchored, the auto end attaches *perpendicular* to the anchored edge, so the
    connector becomes a clean horizontal / vertical line when the ends line up.
  - `corner` — shaft routing / corner style. The route depends on the anchors:
    - **neither anchored**, or **both anchored** → an orthogonal multi-point
      route (right-angle bends between the two attach points)
    - **exactly one anchored** → a straight 2-point connector (the auto end
      attaches perpendicular to the anchored edge)

    `corner` then picks how a multi-point (orthogonal) shaft is drawn — and
    `"straight"` overrides the routing entirely:
    - `"bezier"` — smooth Bézier that leaves each node perpendicular and rounds
      the corners (default)
    - `"sharp"` — polyline with right-angle corners (orthogonal)
    - `"arc"` — straight runs joined by quarter-circle fillets
    - `"straight"` — forces a direct node-to-node line regardless of anchors,
      ignoring both the orthogonal route and the perpendicular snap
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
