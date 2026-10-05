# Cheat-Sheets

A factory for visual, print-ready cheat sheets. The user names a topic or drops
material; Claude extracts what matters and renders DIN A3–A7 PDFs.

## How work happens here

- **Making a sheet**: always follow `.claude/skills/cheatsheet/SKILL.md` (`/cheatsheet`).
- **Markup reference**: `engine/COMPONENTS.md`. Don't invent classes that aren't
  there; add them to `engine/styles/base.css` (and the catalog) if truly needed.
- **Style source of truth**: `examples/`. When the user adds examples, study them
  and encode the style as a theme in `engine/styles/themes/` instead of one-off CSS.

## Layout

| Path | What |
|---|---|
| `sheets/<slug>/` | One topic: `sheet.yaml` (meta + `variants:`), `content.html` (cards with `data-tier`, paginated automatically) — or legacy `sheet.html` (explicit pages) — plus `notes.md`, `diagrams/`, `assets/`, optional `sheet.css` |
| `inbox/<slug>/` | Raw material the user drops in (git-ignored) |
| `examples/` | Reference sheets the user likes — the house style |
| `engine/` | CLI (`render.mjs`), build + server + vendor bundle (`lib/`), formats & depth table (`formats.mjs`), Excalidraw kit, browser code (`client/`: boot, balancer, Mermaid converter), styles |
| `test/` | `node:test` suite; `test/fixtures/<name>/` are minimal sheets rendered by the tests |
| `out/<slug>/<variant>/` | Build output per variant (or `out/<slug>/` without variants): PDF, page PNGs, booted-DOM snapshot HTML, `report.json` (git-ignored) |

## Commands

```bash
npm run new -- <slug> [--format A5] [--orientation portrait] [--depth 2] [--theme sketch] [--density dense|visual] [--title "…"] [--icon book] [--pages-mode]
npm run build -- <slug>[:variant] [--open] [--no-fit] [--no-png] [--print [A4|A3]]
npm test                       # unit + fixture renders (node:test)
```

Each build writes `report.json` next to its PDF (per page: scale, effectivePt, minTextPt, overflow, fill,
hollow, void, balance, cards with slack; plus figures and pagination). `△ hollow` (over 10 % of card area
empty), `△ void` (over 10 % of the page in empty 20 mm blocks: add content or print a smaller format) and
`△ sparse` are warnings the `/cheatsheet` loop must fix, not exit codes. Exit codes — treat every non-zero as a failing test:
1 = a build failed or the input is invalid · 2 = a page overflows, or a variant needs more pages than
its `pages:` · 3 = text under 6 pt (`minTextAt` names it, incl. diagram labels) · 4 = a figure or the print sheet failed.
`npm test` must stay green.

## Conventions

- Fonts and icons are local (`node_modules`), so builds work offline. Don't add CDN links.
- Diagram generators live next to their output (`diagrams/x.mjs` → `x.excalidraw`); output is deterministic.
- Sizes in CSS are `em`, never px, so every format and the auto-fit scale cleanly; sub-1em sizes use
  `max(<em>, var(--min-text))`.
- Anything that deletes files is tested only against a temp-dir sandbox, never real paths. Deletes in
  the engine go through `safeRemove` (refuses anything outside `out/`).
