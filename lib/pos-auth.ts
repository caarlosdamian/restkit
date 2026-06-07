import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import mongoose from 'mongoose';

/**
 * Authenticated business context derived ONLY from the better-auth session
 * cookie. This is the security boundary for the whole POS: businessId, role
 * and identity always come from here, never from client-supplied body/query
 * params. Anything coming from the client (employeeNumber, businessId, role)
 * is display-only and must never be trusted for authorization.
 */
export interface BusinessContext {
  /** businessId as an ObjectId, ready for Mongoose queries */
  businessId: mongoose.Types.ObjectId;
  /** businessId as the raw string (Better Auth stores it as a string) */
  businessIdStr: string;
  userId: string;
  userName: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
}

/**
 * Returns the authenticated business context, or null if there is no valid
 * session. Routes should `return 401` when this is null.
 */
export async function getBusinessContext(): Promise<BusinessContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user as
    | { id: string; name: string; businessId?: string; role?: string }
    | undefined;

  if (!user?.businessId) return null;

  return {
    businessId: new mongoose.Types.ObjectId(user.businessId),
    businessIdStr: user.businessId,
    userId: user.id,
    userName: user.name,
    role: (user.role as BusinessContext['role']) ?? 'STAFF',
  };
}

/** True when the context belongs to a manager (can open/close the register). */
export function isManager(ctx: BusinessContext): boolean {
  return ctx.role === 'OWNER' || ctx.role === 'ADMIN';
}
