import sharp from 'sharp';

/**
 * Reads the left and right edge strips of a page and, when both are one solid
 * color or one clean top/bottom split, returns the band(s) so the site
 * background can extend the page's own color beyond its borders.
 * Returns null when the edges are too busy to call reliably.
 */

type RGB = [number, number, number];
/** Fractions are of page height. `stops` trace the page's own fade between the two colors. */
export interface Edge {
  top: string;
  bottom: string;
  fadeFrom: number;
  fadeTo: number;
  stops: { at: number; color: string }[];
}
type Read = { kind: 'solid'; color: RGB } | { kind: 'split'; top: RGB; bottom: RGB; lo: number; hi: number };

const BUCKETS = 120;        // vertical resolution of the profile
const TOL = 40;             // RGB distance treated as "same color"
const STRAY_MAX = 0.12;     // buckets inside a band allowed to be off-color (lines, bleed)
const TRANSITION_MAX = 0.35; // longest soft fade between the two colors we'll call a split
const SIDES_AGREE = 0.08;   // max difference in split position between left and right

const dist = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const lum = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Median color of each horizontal slice of an edge strip, top to bottom. */
async function profile(path: string, side: 'left' | 'right'): Promise<RGB[]> {
  const meta = await sharp(path).metadata();
  const w = meta.width!, h = meta.height!;
  const sw = Math.max(8, Math.round(w * 0.025));
  const { data } = await sharp(path)
    .extract({ left: side === 'left' ? 0 : w - sw, top: 0, width: sw, height: h })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });

  const out: RGB[] = [];
  for (let b = 0; b < BUCKETS; b++) {
    const y0 = Math.floor((b * h) / BUCKETS), y1 = Math.floor(((b + 1) * h) / BUCKETS);
    const px: RGB[] = [];
    for (let y = y0; y < y1; y++) for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 3;
      px.push([data[i]!, data[i + 1]!, data[i + 2]!]);
    }
    px.sort((a, b) => lum(a) - lum(b));
    out.push(px[px.length >> 1]!);
  }
  return out;
}

const median = (colors: RGB[]): RGB => {
  const s = [...colors].sort((a, b) => lum(a) - lum(b));
  return s[s.length >> 1]!;
};

function read(p: RGB[]): Read | null {
  const n = p.length, anchor = Math.max(3, Math.round(n * 0.1));
  const A = median(p.slice(0, anchor)), B = median(p.slice(-anchor));

  if (dist(A, B) <= TOL) {
    const stray = p.filter((c) => dist(c, A) > TOL).length / n;
    return stray <= STRAY_MAX ? { kind: 'solid', color: median(p) } : null;
  }

  // Two-tone: A on top, B below, with an optional fade between them.
  const near = p.map((c) => (dist(c, A) <= TOL ? 'A' : dist(c, B) <= TOL ? 'B' : '-'));
  const lastA = near.lastIndexOf('A'), firstB = near.indexOf('B');
  if (lastA < 0 || firstB < 0) return null;
  const lo = Math.min(lastA, firstB), hi = Math.max(lastA, firstB);
  if ((hi - lo) / n > TRANSITION_MAX) return null;
  // Outside the transition, the top must be A and the bottom B, give or take a few strays.
  const top = near.slice(0, lo), bottom = near.slice(hi + 1);
  const stray = top.filter((k) => k !== 'A').length + bottom.filter((k) => k !== 'B').length;
  if (stray / n > STRAY_MAX) return null;
  if (top.includes('B') || bottom.includes('A')) return null;

  return { kind: 'split', top: median(p.slice(0, lo + 1)), bottom: median(p.slice(hi)), lo: lo / n, hi: (hi + 1) / n };
}

/** Fraction of samples within tolerance of a color. */
const share = (p: RGB[], c: RGB) => p.filter((x) => dist(x, c) <= TOL).length / p.length;

const solid = (c: RGB): Edge => ({ top: hex(c), bottom: hex(c), fadeFrom: 1, fadeTo: 1, stops: [] });

function reconcile(l: RGB[], r: RGB[]): Edge | null {
  const lr = read(l), rr = read(r);
  if (lr?.kind === 'solid' && rr?.kind === 'solid' && dist(lr.color, rr.color) <= TOL) {
    return solid(median([...l, ...r]));
  }
  if (lr?.kind === 'split' && rr?.kind === 'split'
    && dist(lr.top, rr.top) <= TOL && dist(lr.bottom, rr.bottom) <= TOL
    && Math.abs(lr.lo - rr.lo) <= SIDES_AGREE && Math.abs(lr.hi - rr.hi) <= SIDES_AGREE) {
    const lo = (lr.lo + rr.lo) / 2, hi = (lr.hi + rr.hi) / 2;
    // Trace the fade with the average of both edges, one stop per few buckets.
    const n = l.length, i0 = Math.floor(lo * n), i1 = Math.ceil(hi * n);
    const step = Math.max(1, Math.round((i1 - i0) / 12));
    const stops = [];
    for (let i = i0 + step; i < i1; i += step) {
      const c = l[i]!.map((v, k) => (v + r[i]![k]!) / 2) as RGB;
      stops.push({ at: (i + 0.5) / n, color: hex(c) });
    }
    return { top: hex(lr.top), bottom: hex(lr.bottom), fadeFrom: lo, fadeTo: hi, stops };
  }
  // One side is solid and the other is nearly that color: a small drawing touches the edge.
  for (const [mine, other] of [[lr, r], [rr, l]] as const) {
    if (mine?.kind === 'solid' && share(other, mine.color) >= 1 - STRAY_MAX) return solid(mine.color);
  }
  // Both edges taken together are overwhelmingly one color.
  const all = [...l, ...r], m = median(all);
  if (share(all, m) >= 0.8) return solid(m);
  return null;
}

const cache = new Map<string, Promise<Edge | null>>();

export function pageEdge(path: string): Promise<Edge | null> {
  if (!cache.has(path)) {
    cache.set(path, Promise.all([profile(path, 'left'), profile(path, 'right')]).then(([l, r]) => reconcile(l, r)));
  }
  return cache.get(path)!;
}

/** Perceived lightness 0..1 of a hex color. */
export const lightness = (h: string) => lum(rgb(h)) / 255;
