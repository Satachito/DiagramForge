# DiagramForge `.cde` schema

A `.cde` file is the JSON of the diagram model, tab-indented:

```json
{ "nodes": [ ... ], "links": [ ... ] }
```

`index.html` loads it via the `↑` upload button, and the last session is
auto-restored from `localStorage` (`tokyo.828.diagramforge`). The editor canvas
defaults to **4096 × 4096** pixels (origin top-left, **y axis pointing down**);
canvas size is editor-only and is not stored in `.cde`.

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
[ [ fromID, toID ], ends, paint ]
```

- **`fromID` / `toID`** — must reference existing node IDs.
- **`ends`**:
  - `headF`, `headT` — booleans; draw an arrowhead at the from / to end
  - `anchorF`, `anchorT` — where the link attaches on each node:
    one of `"T"`, `"L"`, `"B"`, `"R"`, `"TL"`, `"TR"`, `"BL"`, `"BR"`,
    or omit (auto: points at the other node's center)
- **`paint`** — same shape as node `paint`.

Example:

```json
[ [ "Core Data", "Analysis" ], { "headF": false, "headT": true },
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
