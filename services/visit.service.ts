import { customerRepository } from '@/repositories/customer.repository';
import { appleDeviceRepository } from '@/repositories/apple-device.repository';
import { businessRepository } from '@/repositories/business.repository';
import { sendAppleWalletPush } from '@/lib/apple-push';
import { updateGoogleWalletObject } from '@/lib/google-wallet';
import Visit from '@/models/Visit';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export const visitService = {
  async recordVisit(customerId: string, businessId: string, employeeId: string) {
    await dbConnect();

    const [customer, business] = await Promise.all([
      customerRepository.findById(customerId, businessId),
      businessRepository.findById(businessId),
    ]);

    if (!customer) throw new Error('Customer not found');
    if (!business) throw new Error('Business not found');

    const required = business.settings.requiredVisits;
    const newTotal = customer.stats.totalVisits + 1;
    const newCurrent = customer.stats.currentVisits + 1;
    const earnedReward = newCurrent >= required;

    await Promise.all([
      new Visit({
        customerId: new mongoose.Types.ObjectId(customerId),
        businessId: new mongoose.Types.ObjectId(businessId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        type: 'VISIT',
      }).save(),
      customerRepository.update(customerId, businessId, {
        stats: {
          totalVisits: newTotal,
          currentVisits: earnedReward ? 0 : newCurrent,
          points: customer.stats.points + 1,
        },
      } as any),
    ]);

    // Get updated customer for wallet sync
    const updatedCustomer = await customerRepository.findById(customerId, businessId);

    // Fire-and-forget wallet updates — non-critical
    if (updatedCustomer) {
      appleDeviceRepository
        .findBySerialNumber(customerId)
        .then((devices) =>
          Promise.allSettled(devices.map((d) => sendAppleWalletPush(d.pushToken)))
        )
        .catch((err) => console.error('APNs push error:', err));

      updateGoogleWalletObject(updatedCustomer, business)
        .catch((err) => console.error('Google Wallet update error:', err));
    }

    return {
      earnedReward,
      totalVisits: newTotal,
      currentVisits: earnedReward ? 0 : newCurrent,
    };
  },
};
