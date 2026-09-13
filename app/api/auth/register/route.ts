import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { businessService } from '@/services/business.service';
import { isThrottled, recordAttempt } from '@/lib/throttle';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';

/**
 * Sign up: create the account, create its business, send the confirmation mail.
 *
 * Server-side because sign-up stopped being something a browser can drive.
 * With `requireEmailVerification` on, better-auth returns no session — and for
 * an address that already exists it returns **200 with a synthetic user**, a
 * plausible object whose id is in no collection. The old flow handed that id
 * straight to an open `POST /api/business`, so a repeat sign-up minted a
 * business owned by nobody. The id from `signUp` is therefore never trusted
 * here; the row is read back from the database instead.
 *
 * A duplicate address is answered plainly — "that email already has an
 * account" — the way every other product does it. That does confirm an address
 * is registered, which is why `/recuperar` and `POST /api/loyalty/join/[slug]`
 * still refuse to: those can be pointed at someone ELSE's address, whereas a
 * sign-up form has to tell the person in front of it why it will not proceed.
 */

/** Per IP. Generous for a person, useless for a script filling the user table. */
const MAX_SIGNUPS = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (isThrottled(`signup:${ip}`, MAX_SIGNUPS)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const businessName = String(body.businessName ?? '').trim();
  const plan = typeof body.plan === 'string' ? body.plan : undefined;
  const billingPeriod = typeof body.period === 'string' ? body.period : undefined;

  if (!name || !email || !password || !businessName) {
    return NextResponse.json(
      { error: 'Faltan campos: nombre, correo, contraseña y nombre del negocio.' },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ese correo no es válido.' }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  // Counts every attempt, not just the ones that create something: the cap is
  // on how fast this endpoint can be driven at all.
  recordAttempt(`signup:${ip}`, MAX_SIGNUPS, WINDOW_MS);

  await dbConnect();
  const users = mongoose.connection.collection('user');

  // Checked here rather than left to better-auth, which would answer 200 with a
  // synthetic user and tell the person nothing.
  if (await users.findOne({ email })) {
    return NextResponse.json(
      {
        error: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
        code: 'EMAIL_TAKEN',
      },
      { status: 409 }
    );
  }

  try {
    // Server API rather than an HTTP self-fetch — same reason staff creation
    // uses it: no APP_URL dependency and no route awaiting its own server.
    // `sendOnSignUp` puts the confirmation mail in flight from in here.
    const created = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        // Where the confirmation link lands. The hook has its own fallback,
        // but saying it here keeps the destination next to the sign-up.
        callbackURL: '/dashboard?correo=verificado',
        // `businessId` is a required additional field on the user, but the
        // business cannot exist yet — it needs this user's id to be created.
        // So the row is inserted with a blank one and `registerBusinessAndOwner`
        // fills it in below, which is the order the old flow used too.
        businessId: '',
      },
      headers: req.headers,
    });

    // Trust the database, never the returned id. If this address somehow still
    // has no row, nothing gets built against a phantom.
    const row = await users.findOne({ email });
    if (!row) {
      console.error('[register] sign-up reported success but no user row exists for', email);
      return NextResponse.json({ error: 'No se pudo crear la cuenta.' }, { status: 500 });
    }

    await businessService.registerBusinessAndOwner({
      businessName,
      ownerId: row._id.toString(),
      ownerName: name,
      ownerEmail: email,
      plan,
      billingPeriod,
    });

    void created;
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A real failure for a genuinely new address. Not an enumeration leak: it
    // only happens on the path where nothing existed a moment ago.
    console.error('[register] failed:', error);
    const message =
      error instanceof Error && error.message ? error.message : 'No se pudo crear la cuenta.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
