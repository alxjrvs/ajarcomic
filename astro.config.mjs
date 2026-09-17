// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages serves the site at the repo root once a custom domain (or
// <user>.github.io) is attached; until then it lives under /<repo>/.
// PUBLIC_BASE lets the workflow set that without touching this file.
const base = process.env.PUBLIC_BASE ?? '/';

export default defineConfig({
  site: process.env.PUBLIC_SITE ?? 'https://alxjrvs.github.io',
  base,
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
});
