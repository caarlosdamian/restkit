import { NextResponse } from 'next/server';
import { generateGoogleWalletUrl } from '@/lib/google-wallet';
import { businessRepository } from '@/repositories/business.repository';
import Customer from '@/models/Customer';
import dbConnect from '@/lib/db';

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

    const walletUrl = generateGoogleWalletUrl(customer, business);
    return NextResponse.redirect(walletUrl);
  } catch (err: any) {
    console.error('Google Wallet error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
