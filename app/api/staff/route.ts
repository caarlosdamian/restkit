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
        businessId: session.user.businessId, // String format (from Better Auth)
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
      employeeNumber: s.employeeNumber,
      role: s.role ?? 'STAFF',
      createdAt: s.createdAt,
    }))
  );
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, email, password, employeeNumber, role = 'STAFF' } = await req.json();

  if (!name || !employeeNumber) {
    return NextResponse.json({ error: 'Nombre y número de empleado son requeridos' }, { status: 400 });
  }

  // ADMIN requires email + password; STAFF only needs employee number
  if (role === 'ADMIN' && (!email || !password)) {
    return NextResponse.json({ error: 'Gerente requiere email y contraseña' }, { status: 400 });
  }

  if (!['STAFF', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
  }

  // Use better-auth's signup for ADMIN; for STAFF just create directly in DB
  await dbConnect();

  if (role === 'ADMIN') {
    // ADMIN: use better-auth for password hashing
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const res = await fetch(`${appUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message ?? 'Error al crear gerente' },
        { status: 400 }
      );
    }

    // Patch role + employeeNumber
    await mongoose.connection.collection('user').updateOne(
      { email },
      {
        $set: {
          role,
          employeeNumber: employeeNumber.trim(),
          businessId: session.user.businessId,
          updatedAt: new Date(),
        },
      }
    );
  } else {
    // STAFF: create directly (email/password not used, only employee number for login)
    const staffEmail = email; // Auto-generated as emp{number}@restkit.local

    const result = await mongoose.connection.collection('user').insertOne({
      name,
      email: staffEmail,
      password: null, // Not used for STAFF
      employeeNumber: employeeNumber.trim(),
      role: 'STAFF',
      businessId: session.user.businessId, // Store as string to match Better Auth format
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!result.insertedId) {
      return NextResponse.json({ error: 'Error al crear empleado' }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
