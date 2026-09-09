import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import path from 'path';

/**
 * Demo data for the E2E suite, written straight into the test database.
 *
 * ⚠️ This used to be `POST /api/restaurants/seed-current`, a route that shipped
 * with the product — along with `/api/restaurants/seed`, which had **no auth at
 * all** and would create a business and staff users for anyone who found it.
 * Demo data belongs to the test harness, not to a deployment serving real
 * restaurants, so the routes are gone and the fixtures live here.
 *
 * `e2e/server.mjs` writes the in-memory Mongo URI to a file, because the
 * Playwright process and the Next server are separate processes and only the
 * one that started the database knows where it is.
 */

export const MONGO_URI_FILE = path.join(process.cwd(), 'e2e', '.mongo-uri');

const TABLES = [
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

const MENU: Array<{ category: string; products: Array<{ name: string; price: number; description: string }> }> = [
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
    ],
  },
  {
    category: 'Postres',
    products: [
      { name: 'Flan Casero', price: 65, description: 'Con cajeta' },
      { name: 'Churros', price: 55, description: 'Con chocolate caliente' },
    ],
  },
  {
    category: 'Bebidas',
    products: [
      { name: 'Refresco (Lata)', price: 25, description: '' },
      { name: 'Cerveza Modelo', price: 50, description: '' },
      { name: 'Café Americano', price: 35, description: '' },
    ],
  },
];

const CUSTOMERS = [
  { name: 'Roberto Flores', email: 'roberto@email.local', phone: '5511111111' },
  { name: 'Carmen Silva', email: 'carmen@email.local', phone: '5522222222' },
  { name: 'Diego Reyes', email: 'diego@email.local', phone: '5533333333' },
];

const STAFF = [
  { name: 'Juan García', employeeNumber: '001', role: 'ADMIN' },
  { name: 'María López', employeeNumber: '002', role: 'STAFF' },
  { name: 'Carlos Pérez', employeeNumber: '003', role: 'STAFF' },
];

/**
 * Seeds the business registered under `businessName`. Matched by name, not
 * slug: /registro appends a random suffix to the slug, so the name is the only
 * thing the caller actually knows.
 */
export async function seedDemoData(businessName: string) {
  const client = new MongoClient(readFileSync(MONGO_URI_FILE, 'utf8').trim());
  await client.connect();
  try {
    const db = client.db();
    const business = await db.collection('businesses').findOne({ name: businessName });
    if (!business) throw new Error(`seed: no business named "${businessName}"`);

    const businessId = business._id as ObjectId;
    // ⚠️ The better-auth `user` collection stores businessId as a STRING while
    // the domain collections use an ObjectId — the known type debt. The seed
    // has to reproduce it or the POS staff lookups find nobody.
    const businessIdStr = businessId.toString();
    const now = new Date();

    await db.collection('user').insertMany(
      STAFF.map((s) => ({
        name: s.name,
        email: `emp${s.employeeNumber}@${businessIdStr}.local`,
        password: null,
        role: s.role,
        businessId: businessIdStr,
        employeeNumber: s.employeeNumber,
        emailVerified: null,
        image: null,
        createdAt: now,
        updatedAt: now,
      }))
    );

    await db.collection('tables').insertMany(
      TABLES.map((t) => ({
        number: t.number,
        name: t.name,
        capacity: t.capacity,
        section: t.section,
        position: { x: t.x, y: t.y },
        businessId,
        isActive: true,
        isOccupied: false,
        createdAt: now,
        updatedAt: now,
      }))
    );

    let sortOrder = 0;
    const products = MENU.flatMap(({ category, products }) =>
      products.map((p) => ({
        name: p.name,
        price: p.price,
        description: p.description,
        category,
        businessId,
        isAvailable: true,
        sortOrder: sortOrder++,
        createdAt: now,
        updatedAt: now,
      }))
    );
    await db.collection('products').insertMany(products);

    await db.collection('customers').insertMany(
      CUSTOMERS.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        businessId,
        stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0 },
        publicToken: randomBytes(20).toString('hex'),
        externalIds: { appleAuthToken: randomBytes(20).toString('hex') },
        createdAt: now,
        updatedAt: now,
      }))
    );

    return { staff: STAFF.length, tables: TABLES.length, products: products.length, customers: CUSTOMERS.length };
  } finally {
    await client.close();
  }
}
