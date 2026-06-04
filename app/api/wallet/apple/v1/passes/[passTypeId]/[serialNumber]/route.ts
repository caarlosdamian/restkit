import { NextResponse } from 'next/server';
import { generateApplePass } from '@/lib/apple-pass';
import { businessRepository } from '@/repositories/business.repository';
import Customer from '@/models/Customer';
import dbConnect from '@/lib/db';

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
    const passBuffer = generateApplePass(customer, business);
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
