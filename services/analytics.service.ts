import Customer from '@/models/Customer';
import Visit from '@/models/Visit';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 2) return 'hace un momento';
  if (mins < 60) return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

export const analyticsService = {
  async getDashboardStats(businessId: string) {
    await dbConnect();
    const bId = new mongoose.Types.ObjectId(businessId);
    const today = startOfToday();
    const sevenDaysAgo = daysAgo(6);

    const [
      totalCustomers,
      visitsToday,
      visitsThisWeek,
      rewardsDelivered,
      rawChart,
      topCustomers,
      recentVisits,
    ] = await Promise.all([
      Customer.countDocuments({ businessId: bId }),

      Visit.countDocuments({
        businessId: bId,
        type: 'VISIT',
        createdAt: { $gte: today },
      }),

      Visit.countDocuments({
        businessId: bId,
        createdAt: { $gte: sevenDaysAgo },
      }),

      Visit.countDocuments({ businessId: bId, type: 'REWARD_REDEMPTION' }),

      Visit.aggregate([
        {
          $match: {
            businessId: bId,
            type: 'VISIT',
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Customer.find({ businessId: bId })
        .sort({ 'stats.totalVisits': -1 })
        .limit(5)
        .select('name email phone stats'),

      Visit.find({ businessId: bId })
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('customerId', 'name'),
    ]);

    // Fill every day of the last 7 days (including days with 0 visits)
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = daysAgo(i);
      const key = d.toISOString().slice(0, 10);
      const match = (rawChart as Array<{ _id: string; count: number }>).find(
        (r) => r._id === key
      );
      chartData.push({
        label: new Intl.DateTimeFormat('es-MX', {
          weekday: 'short',
          day: 'numeric',
        }).format(d),
        count: match?.count ?? 0,
      });
    }

    return {
      totalCustomers,
      visitsToday,
      visitsThisWeek,
      rewardsDelivered,
      chartData,
      topCustomers: topCustomers.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        contact: (c.email || c.phone || '') as string,
        totalVisits: c.stats.totalVisits,
        currentVisits: c.stats.currentVisits,
      })),
      recentVisits: (recentVisits as any[]).map((v) => ({
        id: v._id.toString(),
        customerName: v.customerId?.name ?? 'Cliente',
        type: v.type as 'VISIT' | 'REWARD_REDEMPTION',
        timeAgo: relativeTime(v.createdAt as Date),
      })),
    };
  },
};
