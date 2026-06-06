import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Product from '@/models/Product';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

type Params = Promise<{ productId: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const { productId } = await params;
  const body = await req.json();

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  const product = await Product.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(productId), businessId },
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

  const businessId = new mongoose.Types.ObjectId(session.user.businessId);
  await Product.findOneAndDelete({ _id: new mongoose.Types.ObjectId(productId), businessId });
  return NextResponse.json({ success: true });
}
