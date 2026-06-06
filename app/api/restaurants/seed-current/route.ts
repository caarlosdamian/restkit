import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import Table from '@/models/Table';
import Product from '@/models/Product';
import Customer from '@/models/Customer';

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user?.businessId || !['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();
    const bId = new mongoose.Types.ObjectId(session.user.businessId);
    const businessIdString = session.user.businessId; // Store as string for user collection (Better Auth format)

    // Check if restaurant already has data
    const tableCount = await Table.countDocuments({ businessId: bId });
    if (tableCount > 0) {
      return NextResponse.json(
        { error: 'Este restaurante ya tiene datos. Limpia primero para volver a sembrar.' },
        { status: 400 }
      );
    }

    // 0. Create Staff/Employees (using raw MongoDB to avoid Mongoose validation issues)
    const staffData = [
      { name: 'Juan García', employeeNumber: '001', role: 'ADMIN' },
      { name: 'María López', employeeNumber: '002', role: 'STAFF' },
      { name: 'Carlos Pérez', employeeNumber: '003', role: 'STAFF' },
      { name: 'Ana Martínez', employeeNumber: '004', role: 'STAFF' },
      { name: 'Luis Sánchez', employeeNumber: '005', role: 'STAFF' },
    ];

    for (const staff of staffData) {
      await mongoose.connection.collection('user').insertOne({
        name: staff.name,
        email: `emp${staff.employeeNumber}@${businessIdString}.local`,
        password: null,
        role: staff.role,
        businessId: businessIdString, // Store as string to match Better Auth format
        employeeNumber: staff.employeeNumber,
        emailVerified: null,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 1. Create Tables
    const tableData = [
      { number: 1, name: 'Mesa 1', capacity: 2, section: 'Comedor', x: 100, y: 100 },
      { number: 2, name: 'Mesa 2', capacity: 2, section: 'Comedor', x: 220, y: 100 },
      { number: 3, name: 'Mesa 3', capacity: 4, section: 'Comedor', x: 340, y: 100 },
      { number: 4, name: 'Mesa 4', capacity: 4, section: 'Comedor', x: 460, y: 100 },
      { number: 5, name: 'Mesa 5', capacity: 6, section: 'Comedor', x: 100, y: 240 },
      { number: 6, name: 'Mesa 6', capacity: 6, section: 'Comedor', x: 220, y: 240 },
      { number: 7, name: 'Barra 1', capacity: 1, section: 'Barra', x: 340, y: 240 },
      { number: 8, name: 'Barra 2', capacity: 1, section: 'Barra', x: 380, y: 240 },
      { number: 9, name: 'Barra 3', capacity: 1, section: 'Barra', x: 420, y: 240 },
      { number: 10, name: 'Exterior 1', capacity: 4, section: 'Patio', x: 100, y: 380 },
      { number: 11, name: 'Exterior 2', capacity: 4, section: 'Patio', x: 220, y: 380 },
      { number: 12, name: 'VIP', capacity: 8, section: 'VIP', x: 460, y: 240 },
    ];

    for (const t of tableData) {
      await Table.create({
        number: t.number,
        name: t.name,
        capacity: t.capacity,
        section: t.section,
        position: { x: t.x, y: t.y },
        businessId: bId,
        isActive: true,
      });
    }

    // 2. Create Products
    const menuData = [
      {
        category: 'Entradas',
        products: [
          { name: 'Guacamole y Chips', price: 85, description: 'Aguacate fresco con tortillas caseras' },
          { name: 'Ceviche de Atún', price: 150, description: 'Atún fresco marinado en limón' },
          { name: 'Camarones al Ajillo', price: 180, description: 'Camarones salteados con ajo y limón' },
        ],
      },
      {
        category: 'Platos Principales',
        products: [
          { name: 'Tacos de Barbacoa (3)', price: 120, description: 'Con cebolla y cilantro' },
          { name: 'Tacos al Pastor (3)', price: 95, description: 'Carne marinada y piña' },
          { name: 'Enchiladas Verdes', price: 140, description: 'Con pollo, sour cream y queso' },
          { name: 'Chiles Rellenos', price: 160, description: 'De queso en salsa roja' },
          { name: 'Carne Asada', price: 250, description: 'Con arroz, frijoles y tortillas' },
          { name: 'Pescado a la Veracruzana', price: 280, description: 'Con aceitunas, chiles y tomates' },
        ],
      },
      {
        category: 'Acompañamientos',
        products: [
          { name: 'Arroz Blanco', price: 35, description: '' },
          { name: 'Frijoles Refritos', price: 40, description: '' },
          { name: 'Elote Asado', price: 45, description: 'Con mayo, queso y chile' },
        ],
      },
      {
        category: 'Postres',
        products: [
          { name: 'Flan Casero', price: 65, description: 'Con cajeta' },
          { name: 'Pastel de Tres Leches', price: 75, description: '' },
          { name: 'Churros', price: 55, description: 'Con chocolate caliente' },
        ],
      },
      {
        category: 'Bebidas',
        products: [
          { name: 'Refresco (Lata)', price: 25, description: '' },
          { name: 'Agua Mineral', price: 20, description: '' },
          { name: 'Cerveza Modelo', price: 50, description: '' },
          { name: 'Cerveza Corona', price: 50, description: '' },
          { name: 'Margarita', price: 120, description: 'Clásica, fresa o mango' },
          { name: 'Mojito', price: 100, description: 'Con ron blanco' },
          { name: 'Paloma', price: 90, description: 'Con mezcal' },
          { name: 'Café Americano', price: 35, description: '' },
          { name: 'Cappuccino', price: 45, description: '' },
        ],
      },
    ];

    let sortOrder = 0;
    let totalProducts = 0;
    for (const { category, products } of menuData) {
      for (const p of products) {
        await Product.create({
          name: p.name,
          price: p.price,
          description: p.description,
          category,
          businessId: bId,
          isAvailable: true,
          sortOrder: sortOrder++,
        });
        totalProducts++;
      }
    }

    // 3. Create Sample Customers
    const customerData = [
      { name: 'Roberto Flores', email: 'roberto@email.com', phone: '+52 55 1111 1111' },
      { name: 'Carmen Silva', email: 'carmen@email.com', phone: '+52 55 2222 2222' },
      { name: 'Diego Reyes', email: 'diego@email.com', phone: '+52 55 3333 3333' },
      { name: 'Patricia Ruiz', email: 'patricia@email.com', phone: '+52 55 4444 4444' },
      { name: 'Miguel Torres', email: 'miguel@email.com', phone: '+52 55 5555 5555' },
      { name: 'Sofía Moreno', email: 'sofia@email.com', phone: '+52 55 6666 6666' },
      { name: 'Alejandro Ortega', email: 'alejandro@email.com', phone: '+52 55 7777 7777' },
      { name: 'Valentina Cruz', email: 'valentina@email.com', phone: '+52 55 8888 8888' },
    ];

    for (const c of customerData) {
      await Customer.create({
        name: c.name,
        email: c.email,
        phone: c.phone,
        businessId: bId,
        stats: {
          totalVisits: Math.floor(Math.random() * 15),
          currentVisits: Math.floor(Math.random() * 11),
          points: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Datos de prueba creados exitosamente',
      data: {
        staff: staffData.length,
        tables: tableData.length,
        products: totalProducts,
        customers: customerData.length,
        employeeNumbers: staffData.map(s => s.employeeNumber),
      },
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear datos de prueba' },
      { status: 500 }
    );
  }
}
