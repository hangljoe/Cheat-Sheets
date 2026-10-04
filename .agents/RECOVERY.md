# Recovery note — 2026-10-04

The working tree (incl. `.git`) was deleted by a guard test during the S4 fix loop: `safeRemove(ROOT, ROOT/out/..)`
ran while a mutation sweep had disabled its guard. Commits S1–S3 were local only and were lost.

Rebuilt the same day from the engine files kept in scratch copies and the session transcript:
- engine (S1 foundation, S2 Mermaid, S3 balancer, S4 variants + all review fixes), styles, themes, docs, skill;
- 33 fixtures, 15 test files — `npm test` 81/81; demo `sheets/git` (desk + pocket) renders identically to before.

Not recovered: the per-slice plans, grade rounds, review files and execution reports that lived in `.agents/`
(their conclusions are encoded in the code, tests and docs). Process changes adopted:
- destructive helpers are only tested against temp-dir sandboxes (test/guards.test.mjs);
- slices are pushed to the remote at each boundary.
