import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { randomBytes } from 'crypto';
import dbConnect from '@/lib/db';
import Customer, { newPublicToken } from '@/models/Customer';
import Business from '@/models/Business';
import { evaluateSubscription } from '@/lib/subscription';
import { isThrottled, recordAttempt } from '@/lib/throttle';

/**
 * Self-enrolment from a QR the business prints and puts on the table.
 *
 * Public on purpose — the whole point is that nobody has to be behind a
 * counter for a customer to get a card. Until this existed, every customer had
 * to be typed in by staff, which meant the programme only grew while someone
 * remembered to ask.
 *
 * ⚠️ A PHONE NUMBER IS NOT A SECRET. Anyone can type someone else's. So a
 * phone that ALREADY has a card cannot be claimed here: handing back the token
 * would hand over that person's balance, their pending rewards, and a pass the
 * claimant could present at the counter. New phone → new card. Existing phone →
 * refused, and they ask at the till, where the ticket already prints their
 * card's QR. Lifting that restriction needs an OTP, not a looser rule.
 */

const MAX_PER_WINDOW = 6;
const WINDOW_MS = 10 * 60_000;

function digits(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** Best available client identity. Neither header is trustworthy on its own —
 *  this is a speed bump, not an identity check. */
function clientKey(req: Request, slug: string): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  return `join:${slug}:${ip}`;
}

/**
 * One wording, several reasons.
 *
 * The customer always reads the same sentence — they cannot act on the
 * difference between "your number is registered" and "your number is
 * registered in another format". The `code` carries the distinction for us,
 * which is what makes a report from production diagnosable instead of a guess.
 */
function refuse(code: 'ALREADY_ENROLLED' | 'ALREADY_ENROLLED_FORMAT' | 'ALREADY_ENROLLED_RACE') {
  return NextResponse.json(
    { error: 'Ya tienes una tarjeta con este teléfono. Pídela en el mostrador.', code },
    { status: 409 }
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const key = clientKey(req, slug);

  if (isThrottled(key, MAX_PER_WINDOW)) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera unos minutos.' },
      { status: 429 }
    );
  }

  await dbConnect();
  const business = await Business.findOne({ slug });
  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
  }

  // Enrolling a customer is selling, so it sits behind the same gate as the
  // register and the scanner.
  if (evaluateSubscription(business.subscription).needsUpgrade) {
    return NextResponse.json(
      { error: 'Este programa no está activo por ahora.', code: 'SUBSCRIPTION_REQUIRED' },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const phone = digits(body.phone);
  const name = String(body.name ?? '').trim();

  if (phone.length !== 10) {
    return NextResponse.json(
      { error: 'Escribe tu teléfono a 10 dígitos', code: 'INVALID_PHONE' },
      { status: 400 }
    );
  }

  // Every attempt counts, successful or not: the limit is on how many cards one
  // client can mint, not just on how often it can guess wrong.
  recordAttempt(key, MAX_PER_WINDOW, WINDOW_MS);

  // ── Does this person already have a card? ────────────────────────────────
  // Two lookups, because a phone is not stored in one shape. Self-enrolment
  // writes 10 bare digits; the till and the seed data write what the cashier
  // typed — "+52 55 1234 5678". An exact match alone therefore MISSES a real
  // customer and hands them a second card. The exact query runs first because
  // it uses the unique index; the tolerant one is scoped to businessId (also
  // indexed) so it only ever scans that one business's customers.
  const exact = await Customer.findOne({ businessId: business._id, phone }).select('_id');
  if (exact) {
    // Deliberately no token. See the note at the top of this file.
    return refuse('ALREADY_ENROLLED');
  }

  const sameDigits = await Customer.findOne({
    businessId: business._id,
    phone: { $regex: `${phone.split('').join('\\D*')}$` },
  }).select('_id phone');
  if (sameDigits) {
    // Same human, stored in another format. Refused for the same reason, but
    // under its own code: this one means the card exists and our own writers
    // disagree about how to spell a phone number.
    console.warn(
      `Join: ${phone} matched an existing customer stored as "${sameDigits.phone}" — phone formats are not normalised.`
    );
    return refuse('ALREADY_ENROLLED_FORMAT');
  }

  try {
    const customer = await Customer.create({
      businessId: business._id as mongoose.Types.ObjectId,
      name: name || `Cliente ${phone.slice(-4)}`,
      phone,
      // No welcome stamp. The first one comes from a real purchase, so the
      // counter never has to explain a stamp nobody earned.
      stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0 },
      publicToken: newPublicToken(),
      externalIds: { appleAuthToken: randomBytes(20).toString('hex') },
    });

    return NextResponse.json({ token: customer.publicToken }, { status: 201 });
  } catch (err) {
    const duplicate = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (duplicate.code !== 11000) {
      console.error('Self-enrolment failed:', err);
      return NextResponse.json(
        { error: 'No se pudo crear tu tarjeta', code: 'ENROLMENT_FAILED' },
        { status: 500 }
      );
    }

    // ⚠️ WHICH index collided is the whole story. This used to answer
    // ALREADY_ENROLLED for any duplicate key. A stale `sparse` unique on
    // (businessId, email) — compound, so it indexes every document that has a
    // businessId, email or not — put every email-less customer on
    // (businessId, null). The FIRST self-enrolment at a business worked and
    // every one after it collided, so a stranger with a brand-new number was
    // told they already had a card and sent to a counter that had never heard
    // of them. Only a `phone` collision is that customer's own card.
    const conflict = Object.keys(duplicate.keyPattern ?? {}).join('+') || 'unknown';

    if (duplicate.keyPattern && 'phone' in duplicate.keyPattern) {
      // Two taps on a slow connection racing for the same phone. Real, and its
      // own code so it is never confused with the pre-check above.
      return refuse('ALREADY_ENROLLED_RACE');
    }

    // Dump the live index definitions: this is the one moment we know the
    // database disagrees with the schema, and the shape of that disagreement
    // is the answer. Mongoose cannot alter an existing index, so a database
    // older than the schema keeps `sparse` for ever with nothing reporting it.
    let indexes = 'unavailable';
    try {
      indexes = JSON.stringify(
        (await Customer.collection.indexes()).map((i) => ({
          name: i.name,
          unique: i.unique ?? false,
          sparse: i.sparse ?? false,
          partial: i.partialFilterExpression ?? null,
        }))
      );
    } catch {
      /* diagnostics must never replace the error they describe */
    }
    console.error(
      `Self-enrolment hit a duplicate key on ${conflict}, which is NOT the phone. ` +
        `Run scripts/fix-customer-indexes.mjs. Live indexes: ${indexes}`
    );

    return NextResponse.json(
      {
        error: 'No se pudo crear tu tarjeta. Pídela en el mostrador.',
        code: 'ENROLMENT_CONFLICT',
        conflict,
      },
      { status: 500 }
    );
  }
}
