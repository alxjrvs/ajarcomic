# Ajar

The reader site for *Ajar*, a comic by Alex Jarvis.

## Pages

Everything the site shows lives in [`comic/`](comic/):

- `NN_*.jpg` (or `.png`) — the pages, in filename order. The first is the front page (`/`), the rest are `/2`, `/3`, …
- `coda.md` — the text shown on `/end`, after the last page.

Add or replace a page, commit, and the site rebuilds.

## Develop

```bash
bun install
bun run dev
```

## Deploy

Merging to `main` deploys to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).
