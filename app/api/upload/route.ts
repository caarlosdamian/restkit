import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { putAsset, StorageNotConfiguredError } from '@/lib/storage';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/**
 * Brand asset upload. Before this, `branding.logo` was a text box asking the
 * owner to paste a URL — which is why most cards had no logo at all: a
 * taquería owner has no hosted image to point at.
 *
 * Storage backend is chosen in lib/storage.ts: Vercel Blob when configured,
 * the local filesystem otherwise, so this works out of the box in development.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen no debe pasar de 4 MB' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: 'Formato no soportado. Usa PNG, JPG, WEBP o SVG.' },
      { status: 400 }
    );
  }

  try {
    const asset = await putAsset(`business/${session.user.businessId}`, file);
    return NextResponse.json(asset);
  } catch (err) {
    // A misconfigured deployment, not a failure of this request — say which,
    // so the owner fixes the project instead of retrying the upload.
    if (err instanceof StorageNotConfiguredError) {
      console.error('Asset upload attempted with no blob store configured.');
      return NextResponse.json({ error: err.message, code: err.code }, { status: 503 });
    }
    console.error('Asset upload failed:', err);
    return NextResponse.json({ error: 'No se pudo subir la imagen' }, { status: 500 });
  }
}
