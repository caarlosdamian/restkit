import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The photo the owner uploaded has to survive the network.
 *
 * In production an uploaded photo is a blob URL and every render refetched it.
 * A single failed fetch produced a card WITHOUT the photo at HTTP 200 — no
 * error to see, nothing to retry, the picture simply gone.
 */
const reads = vi.hoisted(() => ({ count: 0, fail: 0, bytes: Buffer.alloc(0) as Buffer }));

vi.mock('@/lib/storage', () => ({
  readAsset: vi.fn(async () => {
    reads.count++;
    if (reads.fail > 0) {
      reads.fail--;
      return null;
    }
    return reads.bytes;
  }),
}));

import { renderStrip, renderStripVariants, __clearAssetCache } from '@/lib/strip-render';
import { loyaltyConfig, DEFAULT_LOYALTY } from '@/lib/loyalty';

const config = (photoPlacement: 'side' | 'background') =>
  loyaltyConfig({
    settings: {
      loyalty: {
        ...DEFAULT_LOYALTY,
        card: { ...DEFAULT_LOYALTY.card, photoPlacement, stripImage: 'https://blob.test/foto.jpg' },
      },
    },
  } as never);

const render = (url: string, scale: 1 | 2 | 3 = 1) =>
  renderStrip({
    currentVisits: 3,
    cashbackBalance: 0,
    config: config('side'),
    brandColor: '#ec4899',
    backgroundUrl: url,
    scale,
  });

/**
 * Samples the top-left corner, which a `side` photo fills edge to edge and
 * which is otherwise flat card ground. Deliberately not the whole left band:
 * with no photo the stamps spread across it, and their discs would read as
 * "a picture is here".
 */
async function hasPhoto(png: Buffer): Promise<boolean> {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(png).metadata();
  const corner = await sharp(png)
    .extract({
      left: 0,
      top: 0,
      width: Math.floor(meta.width! * 0.25),
      height: Math.max(4, Math.floor(meta.height! * 0.1)),
    })
    .png()
    .toBuffer();
  const { channels } = await sharp(corner).stats();
  return channels.slice(0, 3).some((c) => c.stdev > 5);
}

beforeEach(async () => {
  const sharp = (await import('sharp')).default;
  const px = Buffer.alloc(600 * 600 * 3);
  for (let i = 0; i < px.length; i++) px[i] = (i * 37) % 251;
  reads.bytes = await sharp(px, { raw: { width: 600, height: 600, channels: 3 as const } }).jpeg().toBuffer();
  reads.count = 0;
  reads.fail = 0;
  __clearAssetCache();
});

describe('the photo behind the card', () => {
  it('is fetched once, however many times it is drawn', async () => {
    const url = 'https://blob.test/a.jpg';
    for (let i = 0; i < 4; i++) expect(await hasPhoto(await render(url))).toBe(true);
    // Four renders — the owner nudging a field — used to be four downloads.
    expect(reads.count).toBe(1);
  });

  it('collapses the three scales of one pass onto a single fetch', async () => {
    // renderStripVariants asks for @1x/@2x/@3x in parallel: the same photo,
    // three simultaneous requests, on every single pass issued.
    const variants = await renderStripVariants({
      currentVisits: 3,
      cashbackBalance: 0,
      config: config('side'),
      brandColor: '#ec4899',
      backgroundUrl: 'https://blob.test/b.jpg',
    });
    expect(reads.count).toBe(1);
    for (const png of Object.values(variants)) expect(await hasPhoto(png)).toBe(true);
  });

  it('retries a blip instead of shipping a card without the picture', async () => {
    reads.fail = 1;
    expect(await hasPhoto(await render('https://blob.test/c.jpg'))).toBe(true);
    expect(reads.count).toBe(2);
  });

  it('still renders a card when the photo is genuinely gone', async () => {
    // Both attempts fail: the card must exist, just without the photo — a
    // missing picture can never take the customer's stamps down with it.
    reads.fail = 2;
    const png = await render('https://blob.test/d.jpg');
    expect(await hasPhoto(png)).toBe(false);
    expect(png.byteLength).toBeGreaterThan(1000);
    // And nothing was cached, so the next render tries again.
    expect(await hasPhoto(await render('https://blob.test/d.jpg'))).toBe(true);
  });
});
