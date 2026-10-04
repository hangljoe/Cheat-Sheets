# Cheat-Sheets

Visual cheat sheets on any topic, from a single word or a pile of documents.
Print-ready PDFs in DIN A3 down to A7, as shallow or as deep as you like.

## Use it

Open the repo in Claude Code and say what you want:

```
/cheatsheet Kubernetes networking
/cheatsheet Docker A7 depth 1 sketch
/cheatsheet inbox/tax-2026 A4 depth 4 2 pages
```

That's it. Defaults are A4 landscape, depth 3, the clean `studio` theme. To build
from your own material, drop files (PDF, slides, notes, screenshots, links in a
`.txt`) into `inbox/<name>/` and point at that folder.

## The two dials

**Format** sets the physical size: A3 poster, A4 desk sheet, A5 notebook, A6
postcard, A7 pocket card.

**Depth** sets how far it goes:

| Depth | Name | Covers |
|---|---|---|
| 1 | Glance | Core idea and the few things you must never forget |
| 2 | Essentials | The 80/20 |
| 3 | Working | Daily-use reference with examples and gotchas |
| 4 | Deep | Edge cases, comparisons, troubleshooting |
| 5 | Reference | Near-exhaustive |

Deeper means more pages, never smaller text. No printed text is ever smaller than 6 pt.

## One source, many formats

Each topic lives in `sheets/<topic>/`: the cards once in `content.html`, the formats under `variants:`
in `sheet.yaml`. Every card (and every line inside one) carries a `data-tier` from 1 to 5, the depth
at which it starts to appear. An A7 pocket card at depth 1 and an A4 desk sheet at depth 3 come out of
the same file, so fixing a fact fixes every format. Pages are cut automatically, card widths are
balanced automatically, and a few lines of Mermaid become a hand-drawn diagram.

## Themes

`studio` is clean and bright for print. `sketch` is the hand-drawn Excalidraw look.
`midnight` is dark with neon accents, best on screen. Drop sheets you like into
`examples/` and Claude will build a matching theme.

## Manual build

```bash
npm install
npm run build -- git --open        # builds the A4 desk sheet and the A7 pocket card
npm test                           # the engine's test suite
```

Output lands in `out/<topic>/<variant>/` as a PDF plus PNG previews and a `report.json`. The build
reports per page whether the content fits, auto-shrinks or grows type to fill the page, and flags
anything cut off, too small to read, or a diagram that failed.
