import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

// Only OWNER can manage staff
async function requireOwner() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId || session.user.role !== 'OWNER') return null;
  return session;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const staff = await mongoose.connection
    .collection('user')
    .find(
      {
        businessId: session.user.businessId,
        _id: { $ne: new mongoose.Types.ObjectId(session.user.id) },
      },
      { projection: { password: 0 } }
    )
    .sort({ createdAt: -1 })
    .toArray();

  return NextResponse.json(
    staff.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      email: s.email,
      role: s.role ?? 'STAFF',
      createdAt: s.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, password, role = 'STAFF' } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nombre, email y contraseña son requeridos' }, { status: 400 });
  }
  if (!['STAFF', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  // Use better-auth's own signup so it handles password hashing
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const res = await fetch(`${appUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: err.message ?? 'Error al crear el empleado' },
      { status: 400 }
    );
  }

  // Patch businessId + role (same pattern as business registration)
  await dbConnect();
  await mongoose.connection.collection('user').updateOne(
    { email },
    {
      $set: {
        role,
        businessId: session.user.businessId,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ success: true }, { status: 201 });
}
