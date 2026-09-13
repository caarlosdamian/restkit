import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { putAsset, StorageNotConfiguredError } from '@/lib/storage';
import { normalizeUpload } from '@/lib/image-normalize';
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  UPLOAD_TYPES,
  formatNames,
} from '@/lib/upload-limits';


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
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `La imagen no debe pasar de ${MAX_UPLOAD_MB} MB` },
      { status: 400 }
    );
  }
  if (!(UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    // Names the format that was actually sent: "no soportado" alone leaves an
    // owner guessing, and the usual culprit is a HEIC straight off an iPhone.
    const got = file.type ? file.type.replace(/^image\//, '').toUpperCase() : 'ese archivo';
    return NextResponse.json(
      { error: `No podemos usar ${got}. Usa ${formatNames(UPLOAD_TYPES)}.` },
      { status: 400 }
    );
  }

  try {
    // Downscaled before it is stored, never after: the original would
    // otherwise be re-fetched and re-decoded on every card render.
    const asset = await putAsset(`business/${session.user.businessId}`, await normalizeUpload(file));
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
