import Customer from '@/models/Customer';
import Visit from '@/models/Visit';
import Order from '@/models/Order';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';

export type ReportPeriod = 'today' | 'week' | 'month';

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

  /**
   * Sales attributed to each waiter (Fase 3 trazabilidad). Revenue is split at
   * the item level by `items.addedBy`, falling back to the order owner
   * (`staffId`) for lines created before per-item attribution existed.
   */
  async getWaiterSales(businessId: string, period: ReportPeriod) {
    await dbConnect();
    const bId = new mongoose.Types.ObjectId(businessId);

    const since = startOfToday();
    if (period === 'week') since.setDate(since.getDate() - 6);
    if (period === 'month') since.setDate(since.getDate() - 29);

    const rows = await Order.aggregate([
      { $match: { businessId: bId, status: 'PAID', closedAt: { $gte: since } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $ifNull: ['$items.addedBy', '$staffId'] },
          total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          itemCount: { $sum: '$items.quantity' },
          orders: { $addToSet: '$_id' },
        },
      },
      {
        $project: {
          total: 1,
          itemCount: 1,
          orderCount: { $size: '$orders' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Resolve waiter names from the Better Auth `user` collection.
    const ids = rows
      .map((r) => r._id)
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));

    const users = ids.length
      ? await mongoose.connection
          .collection('user')
          .find({ _id: { $in: ids } }, { projection: { name: 1 } })
          .toArray()
      : [];

    const nameById = new Map(users.map((u) => [u._id.toString(), u.name as string]));

    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    return {
      grandTotal,
      waiters: rows.map((r) => {
        const id = r._id ? r._id.toString() : null;
        return {
          staffId: id,
          name: (id && nameById.get(id)) || 'Sin asignar',
          total: r.total as number,
          itemCount: r.itemCount as number,
          orderCount: r.orderCount as number,
          share: grandTotal > 0 ? r.total / grandTotal : 0,
        };
      }),
    };
  },
};
