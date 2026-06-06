import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import User from '@/models/User';
import Business from '@/models/Business';
import Table from '@/models/Table';
import Product from '@/models/Product';
import Customer from '@/models/Customer';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only owner can seed' }, { status: 403 });
  }

  await dbConnect();
  const bId = new mongoose.Types.ObjectId(session.user.businessId);

  try {
    // 1. Update Business with full details
    await Business.findByIdAndUpdate(bId, {
      $set: {
        branding: {
          primaryColor: '#10b981',
          logo: 'https://via.placeholder.com/200x50?text=RestKit',
        },
        settings: {
          requiredVisits: 10,
          rewardDescription: 'Un café o postre gratis',
        },
        ticket: {
          fiscalName: 'RestKit MX S.A. de C.V.',
          rfc: 'RMX200101ABC',
          phone: '+52 55 1234 5678',
          address: 'Av. Paseo de la Reforma 505, Piso 18, CDMX 06500',
          fiscalAddress: 'Av. Paseo de la Reforma 505, Piso 18, CDMX 06500',
          website: 'www.restkit.mx',
          footerMessage: '¡Gracias por tu visita! Síguenos en redes sociales @RestKitMX',
        },
      },
    });

    // 2. Create staff members with employee numbers
    const staffIds: Record<string, string> = {};
    const staffData = [
      { name: 'Juan Pérez', email: 'juan@restkit.local', employeeNumber: '001', role: 'ADMIN' },
      { name: 'María García', email: 'maria@restkit.local', employeeNumber: '002', role: 'STAFF' },
      { name: 'Carlos López', email: 'carlos@restkit.local', employeeNumber: '003', role: 'STAFF' },
      { name: 'Ana Martínez', email: 'ana@restkit.local', employeeNumber: '004', role: 'STAFF' },
      { name: 'Luis Sánchez', email: 'luis@restkit.local', employeeNumber: '005', role: 'STAFF' },
    ];

    for (const staff of staffData) {
      const existing = await User.findOne({ email: staff.email });
      if (!existing) {
        const user = new User({
          name: staff.name,
          email: staff.email,
          businessId: bId,
          role: staff.role,
          employeeNumber: staff.employeeNumber,
          password: 'hashed_password_placeholder',
        });
        await user.save();
        staffIds[staff.employeeNumber] = user._id.toString();
      }
    }

    // 3. Create tables with sections and staff assignments
    const tableData = [
      // Dining Room
      { number: 1, name: 'Mesa 1', capacity: 2, section: 'Comedor', x: 100, y: 100, staff: '002' },
      { number: 2, name: 'Mesa 2', capacity: 2, section: 'Comedor', x: 220, y: 100, staff: '002' },
      { number: 3, name: 'Mesa 3', capacity: 4, section: 'Comedor', x: 340, y: 100, staff: '003' },
      { number: 4, name: 'Mesa 4', capacity: 4, section: 'Comedor', x: 460, y: 100, staff: '003' },
      { number: 5, name: 'Mesa 5', capacity: 6, section: 'Comedor', x: 100, y: 240, staff: '004' },
      { number: 6, name: 'Mesa 6', capacity: 6, section: 'Comedor', x: 220, y: 240, staff: '004' },
      // Bar
      { number: 7, name: 'Barra 1', capacity: 1, section: 'Barra', x: 340, y: 240, staff: '005' },
      { number: 8, name: 'Barra 2', capacity: 1, section: 'Barra', x: 380, y: 240, staff: '005' },
      { number: 9, name: 'Barra 3', capacity: 1, section: 'Barra', x: 420, y: 240, staff: '005' },
      // Patio
      { number: 10, name: 'Exterior 1', capacity: 4, section: 'Patio', x: 100, y: 380, staff: '002' },
      { number: 11, name: 'Exterior 2', capacity: 4, section: 'Patio', x: 220, y: 380, staff: '003' },
      { number: 12, name: 'VIP', capacity: 8, section: 'VIP', x: 460, y: 240, staff: null },
    ];

    for (const t of tableData) {
      const existing = await Table.findOne({ businessId: bId, number: t.number });
      if (!existing) {
        await Table.create({
          number: t.number,
          name: t.name,
          capacity: t.capacity,
          businessId: bId,
          section: t.section,
          position: { x: t.x, y: t.y },
          ...(t.staff && { assignedStaffId: new mongoose.Types.ObjectId(staffIds[t.staff]) }),
        });
      }
    }

    // 4. Create menu products
    const menuData = [
      // Appetizers
      {
        category: 'Entradas',
        products: [
          { name: 'Guacamole y Chips', price: 85, description: 'Aguacate fresco con tortillas caseras' },
          { name: 'Ceviche de Atún', price: 150, description: 'Atún fresco marinado en limón' },
          { name: 'Camarones al Ajillo', price: 180, description: 'Camarones salteados con ajo y limón' },
        ],
      },
      // Mains
      {
        category: 'Platos Principales',
        products: [
          { name: 'Tacos de Barbacoa (3)', price: 120, description: 'Con cebolla y cilantro' },
          { name: 'Tacos al Pastor (3)', price: 95, description: 'Carne marinada y piña' },
          { name: 'Enchiladas Verdes', price: 140, description: 'Con pollo, sour cream y queso' },
          { name: 'Chiles Rellenos', price: 160, description: 'De queso en salsa roja' },
          { name: 'Carne Asada', price: 250, description: 'Con arroz, frijoles y tortillas' },
          { name: 'Pescado a la Veracruzana', price: 280, description: 'Con aceitunas, chiles y tomates' },
          { name: 'Chil Relleno de Camarón', price: 200, description: 'En salsa de jitomate' },
        ],
      },
      // Sides
      {
        category: 'Acompañamientos',
        products: [
          { name: 'Arroz Blanco', price: 35, description: '' },
          { name: 'Frijoles Refritos', price: 40, description: '' },
          { name: 'Elote Asado', price: 45, description: 'Con mayo, queso y chile' },
        ],
      },
      // Desserts
      {
        category: 'Postres',
        products: [
          { name: 'Flan Casero', price: 65, description: 'Con cajeta' },
          { name: 'Pastel de Tres Leches', price: 75, description: '' },
          { name: 'Churros', price: 55, description: 'Con chocolate caliente' },
        ],
      },
      // Beverages
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
    for (const { category, products } of menuData) {
      for (const p of products) {
        const existing = await Product.findOne({ businessId: bId, name: p.name });
        if (!existing) {
          await Product.create({
            name: p.name,
            price: p.price,
            description: p.description,
            category,
            businessId: bId,
            isAvailable: true,
            sortOrder: sortOrder++,
          });
        }
      }
    }

    // 5. Create sample customers
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
      const existing = await Customer.findOne({ businessId: bId, email: c.email });
      if (!existing) {
        const appleToken = require('crypto').randomBytes(20).toString('hex');
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
          externalIds: {
            appleAuthToken: appleToken,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      summary: {
        staff: Object.keys(staffIds).length,
        tables: tableData.length,
        products: menuData.reduce((sum, cat) => sum + cat.products.length, 0),
        customers: customerData.length,
      },
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
