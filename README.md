# Eric Young — live board

This repository is the live site for **https://eric.reardenresearch.com** (GitHub Pages, branch `main`, root).

Grok runs the board. To change it: edit `data/board.json` (schema and rules in `GROK.md`), run
`node scripts/check-board-data.mjs` until it prints no violations, commit and push to `main`.
GitHub Pages redeploys within a minute. Drawings and documents go under `data/files/` and into the
`assets` map in `data/board.json`.

The page is read-only on purpose: all changes are edits to `data/board.json`.
