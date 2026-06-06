import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export async function POST(req: Request) {
  try {
    const { employeeNumber, restaurantCode } = await req.json();

    if (!employeeNumber || !restaurantCode) {
      return NextResponse.json(
        { error: 'Número de empleado y código de restaurante requeridos' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the restaurant by code (slug)
    const business = await mongoose.connection
      .collection('businesses')
      .findOne({ slug: restaurantCode.toLowerCase() });

    if (!business) {
      return NextResponse.json(
        { error: 'Restaurante no encontrado' },
        { status: 404 }
      );
    }

    // Find the employee in this restaurant
    const employee = await mongoose.connection
      .collection('user')
      .findOne({
        businessId: business._id.toString(), // businessId stored as string in user collection
        employeeNumber: employeeNumber.trim(),
        role: { $in: ['STAFF', 'ADMIN', 'OWNER'] }, // Allow all roles to use POS
      });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado en este restaurante' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      employeeId: employee._id.toString(),
      employeeName: employee.name,
      employeeNumber: employee.employeeNumber,
      businessId: business._id.toString(),
      restaurantCode: business.slug,
      role: employee.role,
    });
  } catch (err: any) {
    console.error('POS login error:', err);
    return NextResponse.json(
      { error: 'Error al autenticar' },
      { status: 500 }
    );
  }
}
