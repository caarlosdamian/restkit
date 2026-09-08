import { readFile } from 'fs/promises';
import path from 'path';
import { localUploadDir, usingBlob } from '@/lib/storage';

type Params = Promise<{ path: string[] }>;

const TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/**
 * Serves locally-stored brand assets in development. In production Vercel Blob
 * hands out its own CDN URLs and nothing reaches this route.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  // Never serve from disk when Blob is configured — that combination would
  // mean a stray local file shadowing a real asset.
  if (usingBlob()) return new Response(null, { status: 404 });

  const { path: segments } = await params;

  // Reject traversal before touching the filesystem: `..` or an absolute
  // segment could otherwise walk out of the upload directory.
  if (segments.some((s) => s === '..' || s.includes('/') || s.includes('\\') || s.startsWith('.'))) {
    return new Response(null, { status: 400 });
  }

  const target = path.join(localUploadDir(), ...segments);
  const root = path.resolve(localUploadDir());
  if (!path.resolve(target).startsWith(root + path.sep)) {
    return new Response(null, { status: 400 });
  }

  try {
    const file = await readFile(target);
    const ext = target.split('.').pop()?.toLowerCase() ?? '';
    return new Response(file as unknown as BodyInit, {
      headers: {
        'Content-Type': TYPE_BY_EXT[ext] ?? 'application/octet-stream',
        // Filenames are unique per upload, so this is safe to cache hard.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
