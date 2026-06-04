import { NextResponse } from 'next/server';
import { appleDeviceRepository } from '@/repositories/apple-device.repository';
import Customer from '@/models/Customer';
import dbConnect from '@/lib/db';

type Params = Promise<{ deviceId: string; passTypeId: string }>;

// Apple asks which passes for this device have been updated since a given tag
export async function GET(req: Request, { params }: { params: Params }) {
  const { deviceId, passTypeId } = await params;
  const { searchParams } = new URL(req.url);
  const since = searchParams.get('passesUpdatedSince');

  await dbConnect();
  const devices = await appleDeviceRepository.findByDevice(deviceId, passTypeId);
  if (!devices.length) return new Response(null, { status: 204 });

  const serialNumbers = devices.map((d) => d.serialNumber);

  // Find customers (passes) updated after `since`
  const query: Record<string, unknown> = { _id: { $in: serialNumbers } };
  if (since) query.updatedAt = { $gt: new Date(since) };

  const updated = await Customer.find(query).select('_id updatedAt');
  if (!updated.length) return new Response(null, { status: 204 });

  const lastUpdated = updated.reduce<Date>((max, c) => {
    const ts = c.updatedAt as Date;
    return ts > max ? ts : max;
  }, new Date(0));

  return NextResponse.json({
    lastUpdated: lastUpdated.toISOString(),
    serialNumbers: updated.map((c) => c._id.toString()),
  });
}
