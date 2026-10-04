---
name: cheatsheet
description: Builds a visual, print-ready cheat sheet (DIN A3–A7, depth 1–5, one or many pages) from just a topic or from uploaded material — extracts the critical content, maps it to icons, diagrams and cards, renders a PDF and checks the result visually. Use on "cheat sheet", "Spickzettel", "one-pager", "pocket card", "make this visual", or when the user drops material into inbox/.
argument-hint: "<topic or inbox folder> [A3–A7] [portrait|landscape] [depth 1–5] [pages N] [theme]"
---

# /cheatsheet — topic or material in, beautiful sheet out

The user wants minimum effort: a topic name, or a pile of material. Everything
else has a default. Never ask more than one question, and only when the topic
itself is unclear. State assumptions in one line and go.

## 0. Parse the request

| Parameter | Default | Notes |
|---|---|---|
| format | `A4` | A3 poster · A4 desk · A5 notebook · A6 postcard · A7 pocket card |
| orientation | `landscape` for A3–A5, `portrait` for A6–A7 | |
| depth | `3` | 1 Glance · 2 Essentials · 3 Working · 4 Deep · 5 Reference |
| pages | suggested by `engine/formats.mjs` (depth budget ÷ format capacity) | User's number wins; then scale content to fit it |
| theme | `studio` | `studio` (clean, print) · `sketch` (hand-drawn) · `midnight` (dark, screen) · or a theme derived from `examples/` |
| language | the user's language | set `lang:` in sheet.yaml |

"How deep" maps to depth; "more pages" means more depth at the same density, never
smaller type. Read `examples/` (if it has files) before designing — the user's
examples define the house style and override the defaults here.

## 1. Gather

- **Topic only**: use your own knowledge. Search the web for anything version-
  or date-sensitive (CLI flags, prices, laws, APIs). Note sources in `source:`.
- **Material**: read everything in `inbox/<slug>/` (or what was pasted/linked).
  PDFs via Read with `pages`, images visually, Office files via the docling MCP if
  available, URLs via WebFetch. Never invent facts the material doesn't support
  when the user supplied material: the sheet is a distillation of *their* sources.

## 2. Extract the critical content

Build an inventory, then rank it (keep it in `sheets/<slug>/notes.md`). The ranking
becomes `data-tier` in `content.html`, so ONE source serves every depth and format:

1. List every candidate item: concepts, mental models, procedures, commands/
   syntax, numbers/thresholds, rules, pitfalls, comparisons, definitions.
2. Score each: **use frequency × cost of forgetting**. Pitfalls with high cost
   score high even if rare.
3. The depth budget (cards in `formats.mjs` → `DEPTHS`) is the cut line. Depth 1
   keeps only the core model + 3–5 must-knows. Each step deeper adds the next
   tier: examples, then edge cases, then comparisons and troubleshooting, then
   completeness.
4. Group survivors into cards. Every card and every row inside it gets
   `data-tier="N"` — the smallest depth that should show it (1 = core, always).
   Long phrases that a pocket card can't afford go in a `<span data-tier="2">`.
   Pages are cut automatically; you never place page breaks.

## 3. Map content to visuals

Every section gets the visual form that fits its shape. Read
`engine/COMPONENTS.md` for the markup.

| Content shape | Component |
|---|---|
| Mental model, flow, architecture, relationships | Mermaid figure (`<figure data-mermaid>`) — hand-drawn, auto-laid-out; use `engine/excalidraw-kit.mjs` only when exact placement matters |
| Sequence / procedure | `ol.steps`, or `.flow` if ≤5 short steps |
| Lookup (term → meaning, command → effect) | `dl.kv` or `table` |
| Choice between options | `.vs` or a feature `table` with `td.y`/`td.n` |
| Categories / families | `.tiles` with icons |
| Rules, warnings, golden rules | `.callout` (`danger` for costly mistakes) |
| Key figures | `.stats` |
| Acronyms | `.mnemonic` |
| The one sentence to remember | `p.big` in a `solid` or `tint` card |

Visual rules:
- One **visual anchor** per page minimum (diagram, tiles, flow or stats). A wall
  of `kv` lists is a failure even if the content is right.
- Every card has an icon that means something (search lucide.dev names; check
  `node_modules/lucide-static/icons/<name>.svg` exists).
- Words: fragments, not sentences. Cut articles. ≤ 8 words per bullet on A6/A7.
- Page 1 leads with the big picture (diagram or big idea), detail follows.
- Use tones deliberately: same tone = related sections; `t6` for danger.
- On grid pages let the balancer pick widths; fix a `span-N` only for a deliberate hero (e.g. the big
  diagram). Never hand-tune every card.
- Grid layout for ≤ 10 sections per page (poster feel); `layout: flow` for dense
  reference pages (depth 4–5).

## 4. Build

```bash
npm run new -- <slug> --format A4 --depth 3 --theme studio --title "…" --icon <lucide>
# write sheets/<slug>/content.html (+ diagrams/*.mjs → node them → *.excalidraw)
npm run build -- <slug>            # every variant in sheet.yaml → out/<slug>/<variant>/
npm run build -- <slug>:pocket     # just one
```

The build prints a fit report per page and writes `out/<slug>/<variant>/<slug>-<variant>.pdf`,
`page-N.png` and `report.json`. Auto-fit shrinks type to the per-format floor (never below 6 pt)
or grows it up to 1.25.

## 5. Look, then fix (mandatory)

Read every `page-N.png` and judge it as a designer would:

- exit 2 / `✗ OVERFLOW` → cut the lowest-ranked items, tighten wording, or raise their `data-tier`.
  The floor is per format and never below 6 pt.
- exit 2 / `✗ needs N pages` → the variant's `pages:` is too small for its depth: raise the tier of
  the weakest content, or allow a page.
- exit 3 with `minTextAt: figure:…` → fix the figure, not the text: wider card, higher `--fig-max`, fewer
  nodes, or `LR` → `TD` when width-limited.
- exit 4 / `⚠ figure failed` → fix the Mermaid syntax or file path; never ship a sheet with a ⚠ tile.
- `⚠ … rendered as a plain image` → prefer a flowchart (or the kit) if the hand-drawn look matters.
- exit 3 / `✗ TEXT < 6pt` → enlarge the offending text (`minTextAt` in report.json names it). Custom
  `sheet.css` must never shrink text or `::before/::after` content below 6 pt; that content isn't measured.
- `△ sparse` → add the next-ranked items from notes.md (lower their tier), or enlarge the diagram.
- `△ hollow` (over 10 % of card area empty; the line names the cards) → the named cards are short next
  to tall neighbours: add their next-ranked items, merge two short cards into one, or trim the tall
  neighbour. In cards wider than 4 columns use blocks that stretch (tables, callouts, tiles, `.vs`,
  `cols-2` lists), never a single-column list of short lines.
- Visual check: collisions in diagrams, orphan arrows, cramped cards next to
  empty ones, unreadable text, monotone color, missing anchor.

Iterate until every page reports `✓ fits` and looks right (usually 1–3 rounds).

## 6. Deliver

Show the user page 1 (the PNG) and give the PDF path. One line on what was
cut at this depth, so they know what a deeper version would add. Offer one
variant only if natural (e.g. "A7 pocket version?"): a variant is one more line under
`variants:` in sheet.yaml (format, depth, theme, pages) — never a copied folder. For A6/A7 variants add
`print: { sheet: A4 }` and hand over the `-print-A4.pdf` too (print at 100 %, cut along the marks).
