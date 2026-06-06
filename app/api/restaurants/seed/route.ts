import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import Business from '@/models/Business';
import Table from '@/models/Table';
import Product from '@/models/Product';
import Customer from '@/models/Customer';

export async function POST(req: Request) {
  try {
    const { restaurantName, slug, ownerName, ownerEmail } = await req.json();

    if (!restaurantName || !slug || !ownerName || !ownerEmail) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: restaurantName, slug, ownerName, ownerEmail' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Check if business already exists
    const existing = await Business.findOne({ slug: slug.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { error: `El restaurante con slug "${slug}" ya existe` },
        { status: 409 }
      );
    }

    // 1. Create Business
    const business = new Business({
      name: restaurantName,
      slug: slug.toLowerCase(),
      branding: {
        primaryColor: '#f59e0b',
        logo: 'https://via.placeholder.com/200x50?text=' + encodeURIComponent(restaurantName),
      },
      settings: {
        requiredVisits: 10,
        rewardDescription: 'Una bebida gratis',
      },
      ticket: {
        fiscalName: restaurantName + ' S.A. de C.V.',
        rfc: 'RES' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        phone: '+52 55 1234 5678',
        address: 'Av. Principal 123, Ciudad de México',
        fiscalAddress: 'Av. Principal 123, Ciudad de México',
        website: `${slug}.com`,
        footerMessage: '¡Gracias por tu visita! Síguenos en redes sociales',
      },
    });
    await business.save();
    const businessId = business._id.toString(); // Convert to string for user collection

    console.log(`✓ Negocio creado: ${restaurantName}`);

    // 2. Create Owner (using raw MongoDB)
    await mongoose.connection.collection('user').insertOne({
      name: ownerName,
      email: ownerEmail,
      password: null,
      role: 'OWNER',
      businessId,
      employeeNumber: '000',
      emailVerified: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✓ Dueño creado: ${ownerName}`);

    // 3. Create Staff with employee numbers (using raw MongoDB)
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
        email: `emp${staff.employeeNumber}@${slug}.local`,
        password: null,
        role: staff.role,
        businessId,
        employeeNumber: staff.employeeNumber,
        emailVerified: null,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log(`✓ ${staffData.length} empleados creados`);

    // 4. Create Tables with sections
    const tableData = [
      // Comedor
      { number: 1, name: 'Mesa 1', capacity: 2, section: 'Comedor', x: 100, y: 100 },
      { number: 2, name: 'Mesa 2', capacity: 2, section: 'Comedor', x: 220, y: 100 },
      { number: 3, name: 'Mesa 3', capacity: 4, section: 'Comedor', x: 340, y: 100 },
      { number: 4, name: 'Mesa 4', capacity: 4, section: 'Comedor', x: 460, y: 100 },
      { number: 5, name: 'Mesa 5', capacity: 6, section: 'Comedor', x: 100, y: 240 },
      { number: 6, name: 'Mesa 6', capacity: 6, section: 'Comedor', x: 220, y: 240 },
      // Barra
      { number: 7, name: 'Barra 1', capacity: 1, section: 'Barra', x: 340, y: 240 },
      { number: 8, name: 'Barra 2', capacity: 1, section: 'Barra', x: 380, y: 240 },
      { number: 9, name: 'Barra 3', capacity: 1, section: 'Barra', x: 420, y: 240 },
      // Patio
      { number: 10, name: 'Exterior 1', capacity: 4, section: 'Patio', x: 100, y: 380 },
      { number: 11, name: 'Exterior 2', capacity: 4, section: 'Patio', x: 220, y: 380 },
      { number: 12, name: 'VIP', capacity: 8, section: 'VIP', x: 460, y: 240 },
    ];

    for (const t of tableData) {
      const table = new Table({
        number: t.number,
        name: t.name,
        capacity: t.capacity,
        section: t.section,
        position: { x: t.x, y: t.y },
        businessId,
        isActive: true,
      });
      await table.save();
    }

    console.log(`✓ ${tableData.length} mesas creadas`);

    // 5. Create Menu Products
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
          { name: 'Chil Relleno de Camarón', price: 200, description: 'En salsa de jitomate' },
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
        const product = new Product({
          name: p.name,
          price: p.price,
          description: p.description,
          category,
          businessId,
          isAvailable: true,
          sortOrder: sortOrder++,
        });
        await product.save();
        totalProducts++;
      }
    }

    console.log(`✓ ${totalProducts} productos creados`);

    // 6. Create Sample Customers
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
      const customer = new Customer({
        name: c.name,
        email: c.email,
        phone: c.phone,
        businessId,
        stats: {
          totalVisits: Math.floor(Math.random() * 15),
          currentVisits: Math.floor(Math.random() * 11),
          points: 0,
        },
        externalIds: {
          appleAuthToken: require('crypto').randomBytes(20).toString('hex'),
        },
      });
      await customer.save();
    }

    console.log(`✓ ${customerData.length} clientes creados`);

    return NextResponse.json({
      success: true,
      message: `Restaurante "${restaurantName}" creado exitosamente`,
      data: {
        businessId: businessId.toString(),
        slug: slug.toLowerCase(),
        ownerEmail,
        stats: {
          owner: 1,
          staff: staffData.length,
          tables: tableData.length,
          products: totalProducts,
          customers: customerData.length,
        },
        credentials: {
          owner: {
            email: ownerEmail,
            password: 'Use your actual password',
          },
          posAccess: {
            restaurantCode: slug.toLowerCase(),
            employeeNumbers: staffData.map(s => s.employeeNumber),
          },
        },
      },
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al crear el restaurante' },
      { status: 500 }
    );
  }
}
