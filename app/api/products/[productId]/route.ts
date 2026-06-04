import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Product from '@/models/Product';
import dbConnect from '@/lib/db';

type Params = Promise<{ productId: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { productId } = await params;
  const body = await req.json();

  const product = await Product.findOneAndUpdate(
    { _id: productId, businessId: session.user.businessId },
    { $set: body },
    { new: true }
  );

  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
  return NextResponse.json(product);
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { productId } = await params;

  await Product.findOneAndDelete({ _id: productId, businessId: session.user.businessId });
  return NextResponse.json({ success: true });
}
