# Zukai

Canvas-based cloud architecture diagram editor. Static, no build: plain ES
modules + Web Components loaded directly by `index.html`. Open it from any static
server.

- **Lint:** `npm run lint` (`eslint *.js`). Keep it clean.
- **Code style:** leading-comma / leading-semicolon layout, tab indentation,
  `$`/`_` shorthand identifiers. Match the surrounding code.

## Editing diagrams with AI

The diagram is a plain JSON file (`.zu`). To add/modify/arrange nodes and links,
**edit the `.zu` file directly** or use the **zukai MCP** tools when the dev server
and browser tab are open (see **[USAGE.md](../USAGE.md)**).

Format and safe-edit rules: **[SCHEMA.md](SCHEMA.md)** (English).  
AI contract + `window.DF` / MCP ops: **[AI.md](../AI.md)**.
Sample files live in `Samples/`.

Cloud icon archives (AWS / Azure / GCP) are zipped under `../ICONs/`. You can list
and read SVG/PNG bytes from them directly rather than guessing — but prefer vector
primitives over embedding icon base64 (see SCHEMA.md).
