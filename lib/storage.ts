import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

/**
 * Where brand assets live.
 *
 * Vercel Blob in production; the local filesystem when there's no token, so
 * running the app locally doesn't require a Vercel account just to upload a
 * logo.
 *
 * A local asset is stored as a RELATIVE url. Baking APP_URL in at upload time
 * looked convenient and was the bug behind "the logo doesn't show": APP_URL in
 * development points at a tunnel so Apple can reach the box, so every logo the
 * owner uploaded was served from a host the browser couldn't load — and once
 * the tunnel rotated, couldn't load from anywhere. A relative url always
 * resolves against whatever host the dashboard is on. The few server-side
 * fetchers make it absolute themselves via `absoluteAssetUrl()`.
 */

/**
 * Where local assets land. Resolved per call, not once at import, so a test can
 * point it somewhere disposable — the upload suite tears its directory down
 * afterwards, and when this was a fixed `process.cwd()/.uploads` constant a
 * plain `npm test` deleted the developer's own uploaded logos.
 */
export function localUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), '.uploads');
}

export function usingBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Raised instead of attempting a write that cannot succeed. */
export class StorageNotConfiguredError extends Error {
  readonly code = 'STORAGE_NOT_CONFIGURED';
  constructor() {
    super(
      'BLOB_READ_WRITE_TOKEN no está configurado. En Vercel el disco es de solo ' +
        'lectura, así que no hay a dónde guardar la imagen.'
    );
    this.name = 'StorageNotConfiguredError';
  }
}

function appUrl(): string {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export function extensionFor(file: File): string {
  return EXT_BY_TYPE[file.type] ?? 'png';
}

export interface StoredAsset {
  url: string;
  /** Which backend handled it — surfaced so the UI can warn in local dev. */
  storage: 'blob' | 'local';
}

export const LOCAL_URL_PREFIX = '/api/uploads/';

/**
 * Resolves a stored asset url for a server-side `fetch()` — sharp rendering the
 * strip, the Apple pass builder, the Google Wallet payload. Blob urls come back
 * untouched; a local one is hung off the current APP_URL.
 *
 * It also re-hosts legacy rows that still hold an absolute local url from when
 * putAsset baked one in. Those point at whatever APP_URL was that day, which is
 * usually a tunnel that has since died, so trusting the stored host would keep
 * serving 404s to a customer's pass forever.
 */
export function absoluteAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const at = url.indexOf(LOCAL_URL_PREFIX);
  if (at === -1) return url;
  return appUrl() + url.slice(at);
}

/**
 * `prefix` scopes the asset (e.g. `business/<id>`); the filename is always
 * random, so re-uploading never collides with a URL Apple or Google may still
 * have cached.
 */
/**
 * The form the BROWSER should load. Mirror image of `absoluteAssetUrl`: it
 * strips the host off a local asset so the img tag resolves against whatever
 * origin the dashboard is on — localhost, a preview deploy, the tunnel — and
 * so a legacy row that still carries a dead tunnel host renders anyway.
 */
export function assetSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  const at = url.indexOf(LOCAL_URL_PREFIX);
  return at === -1 ? url : url.slice(at);
}

/**
 * Loads an asset's bytes for server-side work — compositing the strip, building
 * the .pkpass. A local asset is read straight off disk rather than fetched over
 * HTTP from ourselves: the round trip needed APP_URL to be reachable, which in
 * development is a tunnel that is frequently not, and a Next route awaiting its
 * own server is a deadlock risk besides.
 */
export async function readAsset(url?: string | null): Promise<Buffer | null> {
  if (!url) return null;

  const at = url.indexOf(LOCAL_URL_PREFIX);
  if (at === -1) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.error('Asset fetch failed:', url, err);
      return null;
    }
  }

  const key = url.slice(at + LOCAL_URL_PREFIX.length).split('?')[0];
  const root = path.resolve(localUploadDir());
  const target = path.resolve(root, key);
  // The key comes from our own database, but a stored value is still input.
  if (!target.startsWith(root + path.sep)) return null;

  try {
    return await readFile(target);
  } catch {
    return null;
  }
}

export async function putAsset(prefix: string, file: File): Promise<StoredAsset> {
  const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${extensionFor(file)}`;
  const key = `${prefix}/${name}`;

  if (usingBlob()) {
    // Imported lazily so local dev never loads the SDK.
    const { put } = await import('@vercel/blob');
    const blob = await put(key, file, { access: 'public', addRandomSuffix: false });
    return { url: blob.url, storage: 'blob' };
  }

  // The local fallback is a development convenience and is IMPOSSIBLE on
  // Vercel: the filesystem is read-only apart from /tmp, and /tmp is
  // per-instance and ephemeral — a file written there is gone before the
  // customer's pass ever asks for it. Fail with something an owner can act on
  // rather than a generic 500 from a write that was never going to land.
  if (process.env.VERCEL) throw new StorageNotConfiguredError();

  const dir = path.join(localUploadDir(), prefix);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));

  return { url: `${LOCAL_URL_PREFIX}${key}`, storage: 'local' };
}
