import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dbConnect from '@/lib/db';
import { businessRepository } from '@/repositories/business.repository';
import Business from '@/models/Business';

/**
 * The cold-start race that took `/dashboard/customers` down in production with
 *
 *   MongooseError: Cannot call `businesses.findOne()` before initial connection
 *   is complete if `bufferCommands = false`.
 *
 * Three dashboard pages fetch with `Promise.all([someService(...),
 * businessRepository.findById(...)])`. The service awaits `dbConnect()`; the
 * repository did not — and `Promise.all` starts both at once, so the
 * repository's query raced the connection the service was still opening.
 *
 * On a warm lambda the connection is already up and the query lands fine, which
 * is why this only ever showed as "sometimes", and why a reload — landing on a
 * warm instance — appeared to fix it.
 *
 * This suite runs its own server rather than the shared helper, because the
 * helper pre-connects in `beforeAll` and the bug only exists *before* that.
 */

let server: MongoMemoryServer;
let uri: string;

interface DbCache { conn: unknown; promise: unknown }
const cache = (): DbCache => {
  const g = global as unknown as { mongoose?: DbCache };
  if (!g.mongoose) g.mongoose = { conn: null, promise: null };
  return g.mongoose;
};

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  uri = server.getUri('restkit-race-test');
  process.env.MONGODB_URI = uri;
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect().catch(() => {});
  await server?.stop();
  const c = cache();
  c.conn = null;
  c.promise = null;
});

/** Put the process back to how a cold serverless instance starts: nothing
 *  connected, and lib/db.ts's module-level cache empty. */
async function coldStart() {
  await mongoose.disconnect().catch(() => {});
  const c = cache();
  c.conn = null;
  c.promise = null;
}

beforeEach(coldStart);

describe('a repository query racing dbConnect on a cold start', () => {
  it('resolves instead of throwing when the connection is still opening', async () => {
    // Exactly the shape of app/dashboard/customers/page.tsx: dbConnect() is in
    // flight (kicked off by the service) and the repository call goes out
    // alongside it, NOT after it.
    const connecting = dbConnect();

    const business = await businessRepository.findById(
      new mongoose.Types.ObjectId().toString()
    );

    await connecting;
    // No row exists; the point is purely that the query ran at all.
    expect(business).toBeNull();
  });

  it('survives the real Promise.all the page uses', async () => {
    await dbConnect();
    const created = await Business.create({
      name: 'Negocio Carrera',
      slug: `carrera-${Date.now()}`,
      settings: { loyalty: { sellos: { required: 10, rewardDescription: 'x' } } },
    });
    const id = created._id.toString();

    await coldStart();

    // The service half awaits dbConnect internally; the repository half is the
    // one that used to fire early.
    const [fromService, fromRepo] = await Promise.all([
      (async () => {
        await dbConnect();
        return Business.findById(id);
      })(),
      businessRepository.findById(id),
    ]);

    expect(fromService?.name).toBe('Negocio Carrera');
    expect(fromRepo?.name).toBe('Negocio Carrera');
  });
});

describe('a cached connection whose socket has gone', () => {
  it('reconnects instead of handing back a dead handle', async () => {
    await dbConnect();
    const c = cache();
    expect(c.conn).toBeTruthy();

    // What a frozen-then-thawed lambda, an Atlas failover, or a network blip
    // leaves behind: `cached.conn` still truthy, socket gone. dbConnect() used
    // to return it on the strength of that truthiness alone, and the caller's
    // next query died with `MongoNotConnectedError: Client must be connected
    // before running operations`.
    await mongoose.connection.close();
    expect(mongoose.connection.readyState).toBe(0);
    expect(c.conn).toBeTruthy(); // the cache is now a lie

    await dbConnect();

    expect(mongoose.connection.readyState).toBe(1);
    await expect(
      businessRepository.findById(new mongoose.Types.ObjectId().toString())
    ).resolves.toBeNull();
  });
});
