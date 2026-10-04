# Code-review backlog (LOW findings ledger) — carried over after the 2026-10-04 rebuild

| Status | Location | Issue | Origin |
|---|---|---|---|
| OPEN | engine/lib/build.mjs | debug snapshot points at the build's (closed) loopback server | s1 review |
| OPEN | engine/lib/server.mjs | server exposes whole repo root for a build's lifetime; no realpath | s1 review |
| OPEN | engine/client/boot.js | minTextAt names only tag.class — add enclosing card heading | s1 design |
| OPEN | engine/styles/base.css | at A6/A7 floor, secondary text = body size (hierarchy via colour only) | s1 design |
| OPEN | package.json overrides | nanoid 4→5 and lodash-es forced for npm-audit HIGHs; re-check on upgrading mermaid-to-excalidraw | s2 security |
| OPEN | engine/client/skeleton.js | image-fallback fileIds come from nanoid → not byte-deterministic | s2 review |
| OPEN | engine/lib/vendor.mjs | bundle staleness by mtime; a content hash of resolved versions would be stricter | s2 design |
| OPEN | S5 plan | hook imposition inside buildSheet before report.json; render.mjs needs value options (`--print A4`); define merge for nested `print:` | s4 systems |
