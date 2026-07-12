import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let server: MongoMemoryServer | undefined;

interface DbCache {
  conn: unknown;
  promise: unknown;
}

// lib/db.ts grabs a reference to the global cache object at import time, so
// we must MUTATE that same object (never replace it) for dbConnect() inside
// routes to reuse the test connection.
function cache(): DbCache {
  const g = global as unknown as { mongoose?: DbCache };
  if (!g.mongoose) g.mongoose = { conn: null, promise: null };
  return g.mongoose;
}

/** Start an in-memory MongoDB and point mongoose (and lib/db.ts's cache) at it. */
export async function startTestDb(): Promise<void> {
  server = await MongoMemoryServer.create();
  const conn = await mongoose.connect(server.getUri('restkit-test'));
  const c = cache();
  c.conn = conn;
  c.promise = Promise.resolve(conn);

  // Model.init() builds indexes in the background; a test that races a
  // unique index (e.g. duplicate table number, duplicate active order) right
  // after connect can run before the build finishes and get a false pass.
  // Every model imported by a test file is already registered by the time
  // its beforeAll(startTestDb) runs, so build all of them up front here once.
  await Promise.all(Object.values(mongoose.connection.models).map((m) => m.init()));
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await server?.stop();
  const c = cache();
  c.conn = null;
  c.promise = null;
}

/** Wipe every collection between tests (keeps indexes). */
export async function clearTestDb(): Promise<void> {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
