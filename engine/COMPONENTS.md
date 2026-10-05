# Component catalog

Everything a sheet can use. Sizes scale automatically with the format and the auto-fit.

## Content source and variants

Write cards once in `content.html` (a flat list of cards, no `<section>`); the engine cuts pages
automatically. `sheet.yaml` lists the formats to build:

```yaml
title: Git Essentials
icon: git-branch
page_style: "--fig-max: 40mm"        # optional section-level CSS vars, every page
variants:
  desk:   { format: A4, orientation: landscape, depth: 3, pages: 1 }
  pocket: { format: A7, depth: 1, theme: sketch, title: Git in 60s, pages: 1 }
```

`density:` (top level or per variant) sets how much air the page gets: `dense` (no card boxes, one more
column, smaller type and gaps, about 1.8× the content per page: a text-first reference card), `balanced`
(the default: cards, icons, one diagram per page) or `visual` (one column fewer, bigger type, icons and
gaps, about half the content per page: a poster). Density is layout only; the content and its tiers are
the same file. Pair `dense` with a deeper `depth`, `visual` with a shallower one.
`data-tier="N"` (1–5) on any element (card, list item, table row, span) = the smallest depth that shows it.
`data-variants="mono,poster"` on any element keeps it only in the named variants (for banner headings or
prose that belong to one layout); elements without it appear everywhere.
`pages:` is a limit — the engine first re-cuts at a smaller scale, and only fails (exit 2) if that
doesn't help. Variant keys override the top-level ones (shallow merge). Variant names: letters,
digits, `-`, `_`. `layout: flow` switches a variant to newspaper columns; `balance: false` turns the
balancer off. The balancer picks the shortest stack whose **hollow space** (a short card stretched next
to a tall one, as a share of all card area) stays under 10 %; `max_hollow: 0.2` relaxes that, `1` means
shortest stack only. Every build reports `hollow` per page and `slack` per card; above the cap the CLI
prints `△ hollow` naming the cards to fill or trim.

### Printing small cards

`print:` on a variant (or `npm run build -- <slug> --print [A4|A3]`) lays its pages out several to a sheet
with cut marks and writes `<name>-print-A4.pdf` next to the PDF:

```yaml
pocket: { format: A7, depth: 1, print: { sheet: A4 } }                 # 4 cards per A4, cut marks
pocket: { format: A7, depth: 1, print: { sheet: A4, margin: 0 } }      # 8 per A4 (borderless printers), guides
pocket: { format: A6, depth: 2, pages: 2, print: { duplex: true } }    # front/back pairs, flip on the long edge
```

`print: true` = A4. A card with fewer pages than a sheet has slots is repeated to fill it (`fill: false` to
turn that off). Duplex needs an even page count; a print problem is reported in `report.print.error` and exits 4.
Print the sheet at **100 % / actual size**, never "fit to page".

Explicit pages (old style) still work: a `sheet.html` with one `<section class="page">` per page.
A folder must not contain both.

## Page layouts

| Attribute on `<section class="page">` | Effect |
|---|---|
| `data-layout="grid"` (content-mode default) | 12-column grid, poster-like. The **balancer** picks every card's width so rows are full and the page is as short as possible (cards keep their order). A `span-N` class (`span-2` … `span-12`) fixes one card's width; `data-balance="off"` turns balancing off for the page; pages with `rows-2`/`rows-3` cards are left as authored. Rows stretch to fill the page (`data-align="top"` turns that off). |
| `data-layout="flow"` | Newspaper columns (count from format, override with `data-cols="3"`). Cards pour top-to-bottom. `class="wide"` on a child spans all columns. Best for dense reference pages. |
| `data-header="repeat"` | Repeat the title header on this page (default: page 1 only). |

Default columns: A3 4/6 · A4 3/4 · A5 2/3 · A6 1/2 · A7 1/2 (portrait/landscape).

## Card

```html
<div class="card t2" data-tier="1">
  <h2><i data-icon="zap"></i>Title <small>optional note</small></h2>
  …content…
</div>
```

Tone `t1`–`t6` sets the card's color (auto-cycles when omitted), `ink` for neutral.
Variants: `solid` (filled color, white text), `tint` (light wash), `bare` (no box).
`<h2><span class="num">01</span>Title</h2>` gives a numbered section instead of an icon.

### Banner and spot art

`<div class="card banner span-12"><h2>Team and Communication</h2></div>` is a full-width section heading
between cards (no box, no icon; always with `span-12`). `<span class="spot"><i data-icon="ship"></i></span>`
right after a card's `<h2>` is a large spot illustration (4.5 em); it renders only at `density: visual`.
`class="center"` centres a block's text. Together with the `mono` theme this gives the black-and-white
poster look of the Canva examples.

## Icons

`<i data-icon="name"></i>` with any [Lucide](https://lucide.dev/icons) name. Unknown
names render as a dashed red box and are listed in the build output.

## Content blocks

| Need | Markup |
|---|---|
| Term → meaning | `<dl class="kv"><dt><code>cmd</code></dt><dd>what it does</dd>…</dl>` · `kv stack` puts meaning under the term (long terms, narrow cards) |
| Bullets | `ul.dots` · `ul.checks` (do) · `ul.crosses` (don't) · `ul.arrows` · add `cols-2`/`cols-3` for multi-column |
| Ordered process | `<ol class="steps"><li>…</li></ol>` (numbered timeline) |
| Short pipeline | `<div class="flow"><span>A<small>note</small></span><span>B</span></div>` · `flow loop` for cycles |
| Warning / tip | `<div class="callout warn"><i data-icon="triangle-alert"></i><p><b>Title</b> text</p></div>` — `tip` `warn` `danger` `key` `note` |
| Table | plain `<table>` with `thead`; `td.y` ✓ / `td.n` ✗ cells for feature matrices |
| Icon grid | `<div class="tiles" style="--n:3"><div><i data-icon="x"></i><b>Label</b><small>hint</small></div>…</div>` |
| Compare | `<div class="vs"><div><h4>Do</h4>…</div><div><h4>Don't</h4>…</div></div>` · `vs neutral` for A vs B |
| Numbers | `<div class="stats"><div class="stat"><b>80%</b><span>label</span></div>…</div>` |
| Big idea | `<p class="big">One sentence with an <em>accent</em>.</p>` |
| Mnemonic | `<div class="mnemonic"><div><b>S</b><span>Specific</span></div>…</div>` |
| Rating bars | `<div class="meter"><span>Speed</span><i style="--v:80%"></i><span>8/10</span>…</div>` |
| Code | `<pre>` with optional `<span class="c|k|s|v">` for comment/keyword/string/variable |
| Inline | `<code>`, `<kbd>`, `<mark>`, `<span class="chip">`, `.muted`, `.small`, `<hr>` |
| Sub-heading | `<h4>` inside a card |

## Figures

- **Mermaid** (fastest way to a diagram): write Mermaid, get an auto-laid-out, hand-drawn Excalidraw drawing.
  ```html
  <figure data-mermaid><script type="text/mermaid">
  flowchart LR
    A[Idea] -->|draft| B[Sheet] --> C{Fits?}
  </script></figure>
  <figure data-mermaid="diagrams/flow.mmd"></figure>
  ```
  Inline definitions must sit in `<script type="text/mermaid">` (raw `-->` in HTML text gets mangled).
  Flowcharts and sequence diagrams come out hand-drawn. Class, ER and state diagrams are converted natively when
  the library manages it, otherwise (as a class diagram did in our tests) they fall back to a clean embedded
  image, like pie charts and every other type. `data-hand="false"` swaps the hand font for a clean one.
  A broken definition or a wrong file path shows a red ⚠ tile and is listed in `report.json` → `figures.errors`
  (the CLI prints `⚠ figure failed` and the build exits 4).
- **Diagram labels count toward the 6 pt floor.** A figure is scaled to fit its card (and `--fig-max`), so a wide
  `flowchart LR` in a narrow card prints tiny labels and the build exits 3 (`minTextAt: figure:mermaid #N`).
  Labels inside image fallbacks (pie, class, …) are measured too. Fix a too-small figure by giving it a wider card,
  raising its `--fig-max`, cutting nodes, or — only when width is the limit — switching `LR` to `TD` (under a
  height cap `TD` makes labels smaller).
- **Excalidraw**: `<figure data-excalidraw="diagrams/x.excalidraw"><figcaption>…</figcaption></figure>`.
  Generate scenes with `engine/excalidraw-kit.mjs` (boxes, ellipses, diamonds, arrows with
  labels and waypoints, free text). Keep the generator script next to the file
  (`diagrams/x.mjs`) so it can be re-run. Any `.excalidraw` from excalidraw.com works too.
- **Images**: `<figure><img src="assets/photo.png"></figure>` (paths relative to the sheet).
- **Inline SVG**: paste directly; use `currentColor` and `var(--t1)` etc. to stay on-theme.
- Limit a figure's height with `style="--fig-max: 30mm"`.

## Per-sheet overrides

`sheet.css` next to the content is loaded last. `accent: "#hex"` in sheet.yaml recolors the header.
`scale: 1.1` scales the base font; `min_scale` / `max_scale` bound the auto-fit (default 0.86–1.25), always within
the 6 pt floor: `min_scale`, `scale` and `max_scale` can never push text below 6 pt. Every built-in small text style
is floored in CSS; a build with smaller text exits 3.

Blind spot: text drawn by CSS `::before`/`::after` is not measured. Built-in pseudo-content is floored in CSS;
custom `sheet.css` must not shrink it.
