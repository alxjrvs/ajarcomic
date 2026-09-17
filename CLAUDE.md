# ajarcomic

Static Astro site that displays the pages of the comic *Ajar*. bun for everything.

- Pages come from `comic/` (see README). `src/lib/comic.ts` is the only place that reads it.
- `/` is page 1; `/N` for the rest; `/end` shows `comic/coda.md` and links back to `/`.
- No header, no chrome beyond the page counter and ‹ › — keep it that way.
- `bun run build` must pass before a PR. Deploy happens on merge to `main`.
