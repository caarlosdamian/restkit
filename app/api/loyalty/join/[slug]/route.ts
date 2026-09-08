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

  const existing = await Customer.findOne({ businessId: business._id, phone });
  if (existing) {
    // Deliberately no token. See the note at the top of this file.
    return NextResponse.json(
      {
        error: 'Ya tienes una tarjeta con este teléfono. Pídela en el mostrador.',
        code: 'ALREADY_ENROLLED',
      },
      { status: 409 }
    );
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
    // Two taps on a slow connection race to the same phone.
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        {
          error: 'Ya tienes una tarjeta con este teléfono. Pídela en el mostrador.',
          code: 'ALREADY_ENROLLED',
        },
        { status: 409 }
      );
    }
    console.error('Self-enrolment failed:', err);
    return NextResponse.json({ error: 'No se pudo crear tu tarjeta' }, { status: 500 });
  }
}
