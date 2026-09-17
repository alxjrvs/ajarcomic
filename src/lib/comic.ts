import type { ImageMetadata } from 'astro';

// Everything the reader shows lives in /comic at the repo root:
//   NN_*.jpg    pages, ordered by filename; the first one is the front page
//   coda.md     optional; shown on /end
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/comic/*.{jpg,jpeg,png,webp,avif}',
  { eager: true },
);

export const pages: ImageMetadata[] = Object.entries(images)
  .map(([path, mod]) => ({ name: path.split('/').pop()!, image: mod.default }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  .map((e) => e.image);

export const pageCount = pages.length;

export const title = 'Ajar';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** URL for page n (1-based); page 1 is the site root. */
export const pageHref = (n: number) => (n === 1 ? `${base}/` : `${base}/${n}`);
export const endHref = `${base}/end`;
