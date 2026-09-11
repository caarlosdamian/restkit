import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached = (global as any).mongoose;

if (!cached) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cached = (global as any).mongoose = { conn: null, promise: null };
}

const opts = {
  // Fail fast rather than queue commands against a connection that may never
  // arrive. ⚠️ The cost is that ANY query issued while the connection is not
  // fully open throws immediately instead of waiting — which is why the checks
  // below must never hand back a handle that isn't genuinely connected.
  bufferCommands: false,
};

async function dbConnect() {
  if (cached.conn) {
    switch (mongoose.connection.readyState) {
      case 1: // connected — the happy path, and a plain property read
        return cached.conn;

      case 2:
        // Reconnecting. The cached handle is real but not yet usable, and
        // `cached.promise` resolved long ago, so awaiting it would return
        // instantly and the caller's next query would throw. Wait for the
        // socket instead.
        await mongoose.connection.asPromise();
        return cached.conn;

      default:
        // 0 disconnected / 3 disconnecting / 99 uninitialized. A serverless
        // instance that was frozen, an Atlas failover, or a network blip leaves
        // `cached.conn` truthy and the socket gone. Handing it back produces
        // `MongoNotConnectedError: Client must be connected before running
        // operations` on the next query — so drop the cache and reconnect.
        cached.conn = null;
        cached.promise = null;
    }
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
