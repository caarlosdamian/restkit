import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { hashPin } from '@/lib/waiter-token';

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

  const { name, email, password, employeeNumber, role = 'STAFF', pin } = await req.json();

  if (!name || !employeeNumber) {
    return NextResponse.json({ error: 'Nombre y número de empleado son requeridos' }, { status: 400 });
  }

  if (pin !== undefined && pin !== '' && !/^\d{4,6}$/.test(String(pin))) {
    return NextResponse.json({ error: 'El PIN debe tener entre 4 y 6 dígitos' }, { status: 400 });
  }
  const pinHash = pin ? hashPin(String(pin)) : undefined;

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
    // ADMIN: use better-auth's server API directly for password hashing.
    // Calling auth.api avoids an HTTP self-fetch (no dependency on APP_URL /
    // the runtime port, works the same in dev and production).
    try {
      await auth.api.signUpEmail({
        body: { name, email, password, role, businessId: session.user.businessId },
      });
    } catch (err) {
      const message =
        (err as { body?: { message?: string }; message?: string })?.body?.message ??
        (err as { message?: string })?.message ??
        'Error al crear gerente';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Patch role + employeeNumber
    await mongoose.connection.collection('user').updateOne(
      { email },
      {
        $set: {
          role,
          employeeNumber: employeeNumber.trim(),
          businessId: session.user.businessId,
          ...(pinHash ? { pinHash } : {}),
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
      ...(pinHash ? { pinHash } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!result.insertedId) {
      return NextResponse.json({ error: 'Error al crear empleado' }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
