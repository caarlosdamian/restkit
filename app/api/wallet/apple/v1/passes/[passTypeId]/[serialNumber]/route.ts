import { NextResponse } from 'next/server';
import { generateApplePass } from '@/lib/apple-pass';
import { businessRepository } from '@/repositories/business.repository';
import Customer from '@/models/Customer';
import dbConnect from '@/lib/db';
import { loyaltyService } from '@/services/loyalty.service';

type Params = Promise<{ passTypeId: string; serialNumber: string }>;

function getAuthToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^ApplePass (.+)$/);
  return match ? match[1] : null;
}

// Apple fetches an updated pass
export async function GET(req: Request, { params }: { params: Params }) {
  const { serialNumber } = await params;
  const token = getAuthToken(req);

  await dbConnect();
  const customer = await Customer.findById(serialNumber);
  if (!customer) return new Response(null, { status: 404 });

  if (!token || customer.externalIds?.appleAuthToken !== token) {
    return new Response(null, { status: 401 });
  }

  const business = await businessRepository.findById(customer.businessId.toString());
  if (!business) return new Response(null, { status: 404 });

  try {
    // ⚠️ This is the ONLY place the decision can be made. The APNs push carries
    // no payload — it just tells the device to come here — so whether the
    // customer gets a lock-screen notification is settled by what this pass
    // contains, not by what was sent. A removal updates the card in silence.
    const silent = await loyaltyService.lastChangeWasDecrease(serialNumber);
    const passBuffer = await generateApplePass(customer, business, { silent });
    return new Response(passBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Last-Modified': (customer.updatedAt as Date).toUTCString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Pass update error:', err);
    return new Response(null, { status: 500 });
  }
}
