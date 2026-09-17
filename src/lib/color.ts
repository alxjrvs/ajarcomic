import sharp from 'sharp';

/**
 * The page's dominant color: the most common color in a coarse downsample,
 * so the site background can carry it beyond the page's borders.
 */

type RGB = [number, number, number];
const hex = ([r, g, b]: RGB) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
};

const STEP = 16; // quantization per channel

async function compute(path: string): Promise<string> {
  const { data } = await sharp(path)
    .resize({ width: 96, height: 96, fit: 'inside' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });

  // Bucket every pixel by coarse color, then average the winning bucket.
  const buckets = new Map<number, { n: number; sum: RGB }>();
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const key = ((r / STEP) | 0) << 16 | ((g / STEP) | 0) << 8 | ((b / STEP) | 0);
    const bk = buckets.get(key) ?? { n: 0, sum: [0, 0, 0] };
    bk.n++; bk.sum[0] += r; bk.sum[1] += g; bk.sum[2] += b;
    buckets.set(key, bk);
  }
  const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0]!;
  return hex(top.sum.map((v) => v / top.n) as RGB);
}

const cache = new Map<string, Promise<string>>();

export function dominantColor(path: string): Promise<string> {
  if (!cache.has(path)) cache.set(path, compute(path));
  return cache.get(path)!;
}

/** Perceived lightness 0..1 of a hex color. */
export const lightness = lum;
