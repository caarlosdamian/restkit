import { loadSharp } from './sharp-runtime';

/**
 * Shrinks an uploaded image to something a card can actually use.
 *
 * ⚠️ **An owner uploads the photo straight off their phone.** The ones in this
 * project's own dev store are 3814×4767 and 2.5 MB — for a strip that is
 * 1125×369 at its largest (@3x) and a Google hero of 1032×336. Every render
 * then re-downloaded and re-decoded eighteen megapixels to draw a thumbnail:
 * ~900 ms on a Mac reading off local disk, several seconds on Vercel over a
 * blob fetch. That cost lands on the live preview — the owner clicks a
 * placement chip and stares at the previous frame — and again on every pass
 * re-issue, for a photo nobody can see at that resolution.
 *
 * So the original never reaches storage. The format is preserved (a PNG logo
 * keeps its transparency; an SVG is not touched at all) — only the pixels go.
 */

/** Longest edge we keep. 1600 covers the @3x strip with room to crop. */
export const MAX_ASSET_EDGE = 1600;

/** Below this, resizing costs more than it saves. */
const SKIP_BELOW_BYTES = 200 * 1024;

const RESIZABLE = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function normalizeUpload(file: File): Promise<File> {
  if (!RESIZABLE.has(file.type)) return file;
  if (file.size < SKIP_BELOW_BYTES) return file;

  try {
    const sharp = await loadSharp();
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { failOn: 'none' });
    const { width = 0, height = 0 } = await image.metadata();
    if (width <= MAX_ASSET_EDGE && height <= MAX_ASSET_EDGE) return file;

    const pipeline = image.resize(MAX_ASSET_EDGE, MAX_ASSET_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    const out =
      file.type === 'image/png'
        ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
        : file.type === 'image/webp'
          ? await pipeline.webp({ quality: 82 }).toBuffer()
          : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();

    // A re-encode can come out larger than the original (an already-optimised
    // file, a photo that was small to begin with). Keep whichever is smaller.
    if (out.byteLength >= input.byteLength) return file;
    return new File([new Uint8Array(out)], file.name, { type: file.type });
  } catch (err) {
    // Never block an upload on the renderer. A big photo is slow; no photo at
    // all is broken.
    console.error('Upload downscale failed, storing the original:', err);
    return file;
  }
}
