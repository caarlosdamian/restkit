import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Product from '@/models/Product';
import dbConnect from '@/lib/db';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const products = await Product.find({
    businessId: session.user.businessId,
  }).sort({ category: 1, sortOrder: 1, name: 1 });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { name, description, price, category, isAvailable } = await req.json();

  if (!name || price == null) {
    return NextResponse.json({ error: 'Nombre y precio son requeridos' }, { status: 400 });
  }

  const product = await Product.create({
    name,
    description,
    price: Number(price),
    category: category || 'General',
    businessId: session.user.businessId,
    isAvailable: isAvailable !== false,
  });

  return NextResponse.json(product, { status: 201 });
}
