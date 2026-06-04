import { NextResponse } from 'next/server';
import { businessRepository } from '@/repositories/business.repository';
import { generateApplePass } from '@/lib/apple-pass';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    await dbConnect();
    const { customerId } = await params;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const business = await businessRepository.findById(customer.businessId.toString());
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const passBuffer = generateApplePass(customer, business);

    return new Response(passBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${business.slug}-loyalty.pkpass"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Pass generation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
