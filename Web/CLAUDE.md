# DiagramForge

Canvas-based cloud architecture diagram editor. Static, no build: plain ES
modules + Web Components loaded directly by `index.html`. Open it from any static
server.

- **Lint:** `npm run lint` (`eslint *.js`). Keep it clean.
- **Code style:** leading-comma / leading-semicolon layout, tab indentation,
  `$`/`_` shorthand identifiers. Match the surrounding code.

## Editing diagrams with AI

The diagram is a plain JSON file (`.cde`). To add/modify/arrange nodes and links,
**edit the `.cde` file directly** — there is no in-app AI console. The format and
the rules for safe edits are in **[SCHEMA.md](SCHEMA.md)** — read it before
touching a `.cde`. Sample files live in `Samples/`.

Cloud icon archives (AWS / Azure / GCP) are zipped under `../ICONs/`. You can list
and read SVG/PNG bytes from them directly rather than guessing — but prefer vector
primitives over embedding icon base64 (see SCHEMA.md).
