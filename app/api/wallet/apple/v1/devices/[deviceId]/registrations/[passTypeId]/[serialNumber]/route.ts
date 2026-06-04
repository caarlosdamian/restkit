import { NextResponse } from 'next/server';
import { appleDeviceRepository } from '@/repositories/apple-device.repository';
import Customer from '@/models/Customer';
import dbConnect from '@/lib/db';

type Params = Promise<{ deviceId: string; passTypeId: string; serialNumber: string }>;

function getAuthToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^ApplePass (.+)$/);
  return match ? match[1] : null;
}

async function validateToken(serialNumber: string, token: string): Promise<boolean> {
  await dbConnect();
  const customer = await Customer.findById(serialNumber).select('externalIds');
  return customer?.externalIds?.appleAuthToken === token;
}

// Device registers the pass
export async function POST(req: Request, { params }: { params: Params }) {
  const { deviceId, passTypeId, serialNumber } = await params;
  const token = getAuthToken(req);
  if (!token || !(await validateToken(serialNumber, token))) {
    return new Response(null, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const pushToken: string = body.pushToken;
  if (!pushToken) return new Response(null, { status: 400 });

  await dbConnect();
  const { created } = await appleDeviceRepository.upsert(deviceId, serialNumber, passTypeId, pushToken);

  return new Response(null, { status: created ? 201 : 200 });
}

// Device unregisters the pass
export async function DELETE(req: Request, { params }: { params: Params }) {
  const { deviceId, passTypeId: _pt, serialNumber } = await params;
  const token = getAuthToken(req);
  if (!token || !(await validateToken(serialNumber, token))) {
    return new Response(null, { status: 401 });
  }

  await dbConnect();
  await appleDeviceRepository.remove(deviceId, serialNumber);

  return new Response(null, { status: 200 });
}
