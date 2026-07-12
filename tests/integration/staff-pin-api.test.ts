import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { startTestDb, stopTestDb, clearTestDb } from '../helpers/db';
import { resetAuthState } from '../helpers/auth-state';
import { signInAs, jsonRequest, routeParams, createRawUser, oid } from '../helpers/fixtures';
import { PATCH as setPin, DELETE as removeStaff } from '@/app/api/staff/[staffId]/route';
import { verifyPinHash } from '@/lib/waiter-token';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  resetAuthState();
});

const pinReq = (staffId: string, pin: unknown) =>
  setPin(
    jsonRequest(`/api/staff/${staffId}`, { method: 'PATCH', body: { pin } }),
    routeParams({ staffId })
  );

const deleteReq = (staffId: string) =>
  removeStaff(
    jsonRequest(`/api/staff/${staffId}`, { method: 'DELETE' }),
    routeParams({ staffId })
  );

describe('PATCH /api/staff/[staffId] (set POS PIN)', () => {
  it('is OWNER-only (ADMIN gets 401)', async () => {
    const businessId = oid();
    const staffId = await createRawUser({ businessId });

    signInAs(businessId, 'ADMIN');
    expect((await pinReq(staffId.toString(), '1234')).status).toBe(401);
  });

  it('validates the PIN format (4–6 digits)', async () => {
    const businessId = oid();
    const staffId = await createRawUser({ businessId });
    signInAs(businessId, 'OWNER');

    for (const bad of ['12', '1234567', 'abcd', '']) {
      expect((await pinReq(staffId.toString(), bad)).status).toBe(400);
    }
  });

  it('stores a scrypt hash that verifies against the PIN', async () => {
    const businessId = oid();
    const staffId = await createRawUser({ businessId });
    signInAs(businessId, 'OWNER');

    expect((await pinReq(staffId.toString(), '4522')).status).toBe(200);

    const user = await mongoose.connection.collection('user').findOne({ _id: staffId });
    expect(user!.pinHash).toBeTruthy();
    expect(user!.pinHash).not.toContain('4522'); // never stored in the clear
    expect(verifyPinHash('4522', user!.pinHash as string)).toBe(true);
  });

  it('404s for staff of another business', async () => {
    const foreignStaff = await createRawUser({ businessId: oid() });
    signInAs(oid(), 'OWNER');
    expect((await pinReq(foreignStaff.toString(), '1234')).status).toBe(404);
  });
});

describe('DELETE /api/staff/[staffId]', () => {
  it('removes the user together with their sessions and accounts', async () => {
    const businessId = oid();
    const staffId = await createRawUser({ businessId });
    await mongoose.connection.collection('session').insertOne({ userId: staffId.toString(), token: 't' });
    await mongoose.connection.collection('account').insertOne({ userId: staffId.toString() });

    signInAs(businessId, 'OWNER');
    expect((await deleteReq(staffId.toString())).status).toBe(200);

    expect(await mongoose.connection.collection('user').findOne({ _id: staffId })).toBeNull();
    expect(await mongoose.connection.collection('session').countDocuments({ userId: staffId.toString() })).toBe(0);
    expect(await mongoose.connection.collection('account').countDocuments({ userId: staffId.toString() })).toBe(0);
  });

  it('an owner cannot delete themselves', async () => {
    const businessId = oid();
    const owner = signInAs(businessId, 'OWNER');
    expect((await deleteReq(owner.id)).status).toBe(400);
  });

  it('404s for staff of another business', async () => {
    const foreignStaff = await createRawUser({ businessId: oid() });
    signInAs(oid(), 'OWNER');
    expect((await deleteReq(foreignStaff.toString())).status).toBe(404);
  });
});
