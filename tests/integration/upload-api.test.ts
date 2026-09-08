import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { rm, readdir } from 'fs/promises';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, oid } from '../helpers/fixtures';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { localUploadDir, absoluteAssetUrl, assetSrc, readAsset } from '@/lib/storage';

import { POST as upload } from '@/app/api/upload/route';
import { GET as serve } from '@/app/api/uploads/[...path]/route';

// Into a throwaway directory, NEVER the repo's own ./.uploads: this suite
// deletes the tree it points at, and when that was the real one a plain
// `npm test` wiped the developer's uploaded logos.
beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(join(tmpdir(), 'restkit-uploads-'));
  await startTestDb();
});
afterAll(async () => {
  await rm(localUploadDir(), { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
  await stopTestDb();
});
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

// A 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function uploadRequest(file: File): Request {
  const form = new FormData();
  form.append('file', file);
  return new Request('http://localhost:3000/api/upload', { method: 'POST', body: form });
}

const png = (name = 'logo.png') => new File([PNG], name, { type: 'image/png' });

describe('POST /api/upload', () => {
  it('is manager-only', async () => {
    resetAuthState();
    expect((await upload(uploadRequest(png()))).status).toBe(401);

    signInAs(oid(), 'STAFF');
    expect((await upload(uploadRequest(png()))).status).toBe(401);
  });

  it('stores locally when Vercel Blob is not configured', async () => {
    // Local dev must work without a Vercel account — this used to 500.
    signInAs(oid(), 'OWNER');
    const res = await upload(uploadRequest(png()));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.storage).toBe('local');
    // RELATIVE, and that is the fix for "the logo doesn't show in development".
    // This used to bake APP_URL in at upload time; APP_URL in dev points at a
    // tunnel so Apple can reach the box, so every logo an owner uploaded was
    // served from a host their own browser could not load.
    expect(data.url).not.toMatch(/^https?:\/\//);
    expect(data.url).toMatch(/^\/api\/uploads\/business\//);
  });

  it('rejects a file that is not an image', async () => {
    signInAs(oid(), 'OWNER');
    const bad = new File(['#!/bin/sh'], 'x.sh', { type: 'application/x-sh' });
    expect((await upload(uploadRequest(bad))).status).toBe(400);
  });

  it('rejects a file over the size cap', async () => {
    signInAs(oid(), 'OWNER');
    const big = new File([Buffer.alloc(5 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    expect((await upload(uploadRequest(big))).status).toBe(400);
  });

  it('gives every upload its own name so a re-upload never shadows a cached URL', async () => {
    const businessId = oid();
    signInAs(businessId, 'OWNER');

    const a = await (await upload(uploadRequest(png()))).json();
    const b = await (await upload(uploadRequest(png()))).json();

    expect(a.url).not.toBe(b.url);
    const files = await readdir(`${localUploadDir()}/business/${businessId}`);
    expect(files).toHaveLength(2);
  });
});

describe('GET /api/uploads/[...path]', () => {
  it('serves back what was just uploaded', async () => {
    signInAs(oid(), 'OWNER');
    const { url } = await (await upload(uploadRequest(png()))).json();
    const segments = url.replace('/api/uploads/', '').split('/');

    const res = await serve(new Request(`http://localhost:3000${url}`), {
      params: Promise.resolve({ path: segments }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
  });

  it('refuses to walk out of the upload directory', async () => {
    for (const attack of [['..', '..', 'etc', 'passwd'], ['..'], ['.env']]) {
      const res = await serve(new Request('http://localhost:3000/api/uploads/x'), {
        params: Promise.resolve({ path: attack }),
      });
      expect(res.status).toBe(400);
    }
  });

  it('404s for a file that does not exist', async () => {
    const res = await serve(new Request('http://localhost:3000/api/uploads/x'), {
      params: Promise.resolve({ path: ['business', 'nope', 'nope.png'] }),
    });
    expect(res.status).toBe(404);
  });

  it('serves nothing once Blob is configured', async () => {
    // Otherwise a stray local file could shadow a real production asset.
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
    const res = await serve(new Request('http://localhost:3000/api/uploads/x'), {
      params: Promise.resolve({ path: ['business', 'a', 'b.png'] }),
    });
    expect(res.status).toBe(404);
  });
});

describe('resolving a stored asset url', () => {
  const BLOB = 'https://abc123.public.blob.vercel-storage.com/business/1/logo.png';

  it('hands the browser a relative path it can always load', () => {
    expect(assetSrc('/api/uploads/business/1/logo.png')).toBe('/api/uploads/business/1/logo.png');
    // A row written before the fix carries whatever APP_URL was that day —
    // usually a tunnel that has since died. Strip the host rather than 404.
    expect(assetSrc('https://old-tunnel.ngrok-free.dev/api/uploads/business/1/logo.png')).toBe(
      '/api/uploads/business/1/logo.png'
    );
    expect(assetSrc(BLOB)).toBe(BLOB);
    expect(assetSrc(undefined)).toBeUndefined();
  });

  it('re-hosts a legacy absolute url on the CURRENT app url', () => {
    // Google fetches the logo from its own servers, so it needs an absolute
    // url — and trusting the dead host stored on the row would serve 404s to
    // a customer's pass forever.
    process.env.APP_URL = 'https://now.example.test';
    expect(absoluteAssetUrl('https://old-tunnel.ngrok-free.dev/api/uploads/business/1/logo.png')).toBe(
      'https://now.example.test/api/uploads/business/1/logo.png'
    );
    expect(absoluteAssetUrl('/api/uploads/business/1/logo.png')).toBe(
      'https://now.example.test/api/uploads/business/1/logo.png'
    );
    expect(absoluteAssetUrl(BLOB)).toBe(BLOB);
  });

  it('reads a local asset off disk instead of over HTTP', async () => {
    signInAs(oid(), 'OWNER');
    const { url } = await (await upload(uploadRequest(png()))).json();

    // No server needs to be listening, and APP_URL is irrelevant.
    process.env.APP_URL = 'https://a-host-that-does-not-resolve.invalid';
    expect(await readAsset(url)).toEqual(PNG);
  });

  it('refuses to walk out of the upload directory', async () => {
    expect(await readAsset('/api/uploads/../../../etc/passwd')).toBeNull();
    expect(await readAsset('/api/uploads/business/1/missing.png')).toBeNull();
    expect(await readAsset(undefined)).toBeNull();
  });
});
