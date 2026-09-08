import { loyaltyService } from '@/services/loyalty.service';

export const visitService = {
  /**
   * Record a visit by hand from the dashboard — the path for a business with
   * no POS terminal, or a correction. Everything goes through the ledger, so a
   * hand-recorded visit is reversible exactly like one earned at the register.
   */
  async recordVisit(customerId: string, businessId: string, employeeId: string) {
    const result = await loyaltyService.accrueForOrder({
      customerId,
      businessId,
      employeeId,
      // No order behind it, so no ticket total and no per-order idempotency.
      orderTotal: 0,
      manual: true,
    });

    if (!result) throw new Error('Customer not found');

    return {
      earnedReward: result.justEarnedReward,
      totalVisits: result.currentVisits,
      currentVisits: result.currentVisits,
      rewardsPending: result.rewardsPending,
    };
  },
};
