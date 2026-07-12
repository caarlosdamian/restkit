import mongoose from 'mongoose';
import { setSession, MockSessionUser } from './auth-state';

export const oid = () => new mongoose.Types.ObjectId();

/**
 * Signs the terminal in as a user of the given business. Returns the mock
 * user so tests can assert attribution (`user.id` is a valid ObjectId hex
 * string, as routes convert it with `new mongoose.Types.ObjectId(ctx.userId)`).
 */
export function signInAs(
  businessId: mongoose.Types.ObjectId,
  role: 'OWNER' | 'ADMIN' | 'STAFF' = 'OWNER',
  overrides: Partial<MockSessionUser> = {}
): MockSessionUser {
  const user: MockSessionUser = {
    id: oid().toString(),
    name: 'Gerente Test',
    businessId: businessId.toString(),
    role,
    ...overrides,
  };
  setSession(user);
  return user;
}

/** Build a Request the way Next.js route handlers expect it. */
export function jsonRequest(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
  const { method = 'GET', body, headers = {} } = opts;
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** App Router dynamic segments arrive as a promise. */
export function routeParams<T extends Record<string, string>>(p: T): { params: Promise<T> } {
  return { params: Promise.resolve(p) };
}

/**
 * Insert a user the way Better Auth stores them: raw `user` collection with
 * businessId as a STRING (the known type inconsistency the routes work around).
 */
export async function createRawUser(opts: {
  businessId: mongoose.Types.ObjectId;
  name?: string;
  role?: 'OWNER' | 'ADMIN' | 'STAFF';
  pinHash?: string | null;
  employeeNumber?: string;
}): Promise<mongoose.Types.ObjectId> {
  const _id = oid();
  await mongoose.connection.collection('user').insertOne({
    _id,
    name: opts.name ?? 'Mesero Test',
    email: `${_id.toString()}@test.local`,
    businessId: opts.businessId.toString(),
    role: opts.role ?? 'STAFF',
    pinHash: opts.pinHash ?? null,
    employeeNumber: opts.employeeNumber,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return _id;
}
