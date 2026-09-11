import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Customer, { ICustomer } from '@/models/Customer';
import Visit, { IVisit } from '@/models/Visit';
import Business from '@/models/Business';
import { appleDeviceRepository } from '@/repositories/apple-device.repository';
import { sendAppleWalletPushes } from '@/lib/apple-push';
// Aliased: `accrueForOrder` has a local `const after = stampState(...)`, and two
// different `after`s in one file is a trap for the next reader.
import { after as runAfterResponse } from 'next/server';
import { updateGoogleWalletObject } from '@/lib/google-wallet';
import {
  loyaltyConfig,
  accrualFor,
  applyDelta,
  stampState,
  maxCashbackFor,
  round2,
  type Accrual,
} from '@/lib/loyalty';
import type { ILoyaltyConfig } from '@/models/Business';

/**
 * The ledger. Nothing else in the app writes `Customer.stats` — every change
 * is an entry here plus the counter it implies, so the history always explains
 * the current number.
 *
 * Entries are never deleted. Removing a purchase writes a compensating
 * REVERSAL; the original stays visible.
 */

/** A duplicate key on uniq_accrual_per_order means this order already earned —
 *  a retried PATCH, not a second stamp. */
function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Run best-effort work that must not delay the response — but must actually
 * get to finish.
 *
 * ⚠️ A bare un-awaited promise is NOT that. A serverless instance is frozen the
 * instant its response is sent, so work still in flight is suspended part-done
 * and only resumes if that same instance is later thawed to serve another
 * request. Wallet pushes were fired that way: roughly half a second of TLS
 * handshake, APNs request and Google OAuth, started at the exact moment the
 * runtime stopped running it. The stamp landed in Mongo immediately and the
 * customer's phone heard about it minutes later, or never — and on a quiet till
 * "never" was the common case, because nothing came along to thaw the instance.
 *
 * `after()` is the platform's answer: the response goes out now, the work is
 * kept alive to completion. It throws outside a request scope (tests, scripts,
 * seeds), which is what the fallback covers — there is no response to race
 * there, so running it inline is correct.
 */
function afterResponse(work: () => Promise<void>): void {
  try {
    runAfterResponse(work);
  } catch {
    void work().catch((err) => console.error('Wallet sync error:', err));
  }
}

/** Wallet updates are best-effort: a push that fails must never fail a payment. */
function syncWallet(customer: ICustomer, business: unknown, silent = false) {
  const customerId = String(customer._id);

  afterResponse(async () => {
    const tasks: Promise<void>[] = [];

    if (!silent) {
      tasks.push(
        (async () => {
          const devices = await appleDeviceRepository.findBySerialNumber(customerId);
          const results = await sendAppleWalletPushes(devices.map((d) => d.pushToken));
          // Logged individually: a token Apple has retired fails forever, and
          // the only way anyone finds out is a line that names it.
          for (const r of results) {
            if (!r.ok) console.error(`APNs push failed for ${r.pushToken}:`, r.error);
          }
        })()
      );
    }

    tasks.push(updateGoogleWalletObject(customer, business as never));

    // allSettled, not all: Apple being down must not skip Google.
    const settled = await Promise.allSettled(tasks);
    for (const s of settled) {
      if (s.status === 'rejected') console.error('Wallet sync error:', s.reason);
    }
  });
}

interface AccrueArgs {
  customerId: string | mongoose.Types.ObjectId;
  businessId: string | mongoose.Types.ObjectId;
  employeeId: string | mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  orderTotal: number;
  tableName?: string;
  /** Recorded by hand from the dashboard rather than earned at the register.
   *  A manager doing this deliberately isn't subject to the anti-farming
   *  guards, which exist to stop a split bill from farming stamps. */
  manual?: boolean;
}

export interface AccrualResult {
  earned: boolean;
  mechanic: 'sellos' | 'cashback';
  delta: number;
  currentVisits: number;
  totalVisits: number;
  cashbackBalance: number;
  rewardsPending: number;
  /** True when this accrual is the one that completed a card. */
  justEarnedReward: boolean;
}

/** A hand-recorded entry: one stamp, or the configured percentage of an amount
 *  the manager typed in. Skips the guards — see AccrueArgs.manual. */
function manualAccrual(config: ILoyaltyConfig, amount: number): Accrual | null {
  if (config.mechanic === 'sellos') return { mechanic: 'sellos', delta: 1 };
  if (amount <= 0) return null;
  return { mechanic: 'cashback', delta: round2((amount * config.cashback.rate) / 100) };
}

export const loyaltyService = {
  /**
   * Earn from a paid order. Idempotent per (order, mechanic): a retried PATCH
   * loses the race on the unique index and returns the unchanged state.
   */
  async accrueForOrder(args: AccrueArgs): Promise<AccrualResult | null> {
    await dbConnect();

    const customerId = new mongoose.Types.ObjectId(String(args.customerId));
    const businessId = new mongoose.Types.ObjectId(String(args.businessId));

    const [customer, business] = await Promise.all([
      Customer.findOne({ _id: customerId, businessId }),
      Business.findById(businessId),
    ]);
    if (!customer || !business) return null;

    const config = loyaltyConfig(business);

    // Only needed when a daily cap is configured.
    let todayCount = 0;
    if (config.mechanic === 'sellos' && config.sellos.maxPerDay != null) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      todayCount = await Visit.countDocuments({
        customerId,
        type: 'ACCRUAL',
        mechanic: 'sellos',
        createdAt: { $gte: startOfDay },
      });
    }

    const accrual = args.manual
      ? manualAccrual(config, args.orderTotal)
      : accrualFor({ total: args.orderTotal, todayCount }, config);

    if (!accrual) {
      return {
        earned: false,
        mechanic: config.mechanic,
        delta: 0,
        currentVisits: customer.stats.currentVisits,
        totalVisits: customer.stats.totalVisits,
        cashbackBalance: customer.stats.cashbackBalance,
        rewardsPending: stampState(customer.stats.currentVisits, config.sellos.required)
          .rewardsPending,
        justEarnedReward: false,
      };
    }

    try {
      await Visit.create({
        customerId,
        businessId,
        employeeId: new mongoose.Types.ObjectId(String(args.employeeId)),
        type: 'ACCRUAL',
        mechanic: accrual.mechanic,
        delta: accrual.delta,
        orderId: args.orderId,
        orderTotal: args.orderTotal,
        tableName: args.tableName,
      });
    } catch (err) {
      if (isDuplicateKey(err)) return null; // already earned for this order
      throw err;
    }

    const before = stampState(customer.stats.currentVisits, config.sellos.required);

    if (accrual.mechanic === 'sellos') {
      customer.stats.currentVisits = applyDelta(customer.stats.currentVisits, accrual.delta);
      customer.stats.totalVisits += 1;
    } else {
      customer.stats.cashbackBalance = applyDelta(customer.stats.cashbackBalance, accrual.delta);
      customer.stats.totalVisits += 1;
    }
    await customer.save();

    const after = stampState(customer.stats.currentVisits, config.sellos.required);
    syncWallet(customer, business);

    return {
      earned: true,
      mechanic: accrual.mechanic,
      delta: accrual.delta,
      currentVisits: customer.stats.currentVisits,
      totalVisits: customer.stats.totalVisits,
      cashbackBalance: customer.stats.cashbackBalance,
      rewardsPending: after.rewardsPending,
      justEarnedReward: after.rewardsPending > before.rewardsPending,
    };
  },

  /** Claim a completed stamp card. Writes the REWARD_REDEMPTION that
   *  "Premios entregados" counts — nothing else ever wrote it. */
  async redeemReward(args: {
    customerId: string;
    businessId: string;
    employeeId: string;
    orderId?: mongoose.Types.ObjectId;
  }) {
    await dbConnect();
    const customerId = new mongoose.Types.ObjectId(args.customerId);
    const businessId = new mongoose.Types.ObjectId(args.businessId);

    const [customer, business] = await Promise.all([
      Customer.findOne({ _id: customerId, businessId }),
      Business.findById(businessId),
    ]);
    if (!customer || !business) throw new Error('Cliente no encontrado');

    const config = loyaltyConfig(business);
    const required = config.sellos.required;
    const state = stampState(customer.stats.currentVisits, required);
    if (state.rewardsPending < 1) throw new Error('Este cliente no tiene un premio disponible');

    await Visit.create({
      customerId,
      businessId,
      employeeId: new mongoose.Types.ObjectId(args.employeeId),
      type: 'REWARD_REDEMPTION',
      mechanic: 'sellos',
      delta: -required,
      orderId: args.orderId,
    });

    customer.stats.currentVisits = applyDelta(customer.stats.currentVisits, -required);
    await customer.save();
    syncWallet(customer, business);

    return {
      currentVisits: customer.stats.currentVisits,
      rewardsPending: stampState(customer.stats.currentVisits, required).rewardsPending,
    };
  },

  /** Spend cashback against a bill. Returns the amount actually applied. */
  async redeemCashback(args: {
    customerId: string;
    businessId: string;
    employeeId: string;
    orderTotal: number;
    requested: number;
    orderId?: mongoose.Types.ObjectId;
  }): Promise<number> {
    await dbConnect();
    const customerId = new mongoose.Types.ObjectId(args.customerId);
    const businessId = new mongoose.Types.ObjectId(args.businessId);

    const [customer, business] = await Promise.all([
      Customer.findOne({ _id: customerId, businessId }),
      Business.findById(businessId),
    ]);
    if (!customer || !business) throw new Error('Cliente no encontrado');

    const config = loyaltyConfig(business);
    const cap = maxCashbackFor(customer.stats.cashbackBalance, args.orderTotal, config);
    const applied = Math.min(cap, Math.max(0, args.requested));
    if (applied <= 0) return 0;

    await Visit.create({
      customerId,
      businessId,
      employeeId: new mongoose.Types.ObjectId(args.employeeId),
      type: 'REWARD_REDEMPTION',
      mechanic: 'cashback',
      delta: -applied,
      orderId: args.orderId,
      orderTotal: args.orderTotal,
    });

    customer.stats.cashbackBalance = applyDelta(customer.stats.cashbackBalance, -applied);
    await customer.save();
    syncWallet(customer, business);

    return applied;
  },

  /**
   * Undo an earlier entry. The original is kept and a compensating entry is
   * written beside it.
   *
   * Two rules are absolute: a delivered reward is never clawed back, and
   * reversing a cashback redemption returns the balance without touching the
   * order, its ticket, or that shift's cash-up — those were signed off as they
   * happened, and a manager who did nothing wrong should not inherit a
   * retroactive shortfall.
   */
  async reverse(args: { visitId: string; businessId: string; employeeId: string }) {
    await dbConnect();
    const businessId = new mongoose.Types.ObjectId(args.businessId);

    const entry = await Visit.findOne({
      _id: new mongoose.Types.ObjectId(args.visitId),
      businessId,
    });
    if (!entry) throw new Error('Movimiento no encontrado');

    if (entry.type === 'REVERSAL') throw new Error('Una reversa no se puede revertir');
    if (entry.type === 'REWARD_REDEMPTION' && entry.mechanic === 'sellos') {
      throw new Error('Un premio ya entregado no se puede revertir');
    }

    const already = await Visit.findOne({ reversesVisitId: entry._id });
    if (already) throw new Error('Este movimiento ya fue revertido');

    const customer = await Customer.findOne({ _id: entry.customerId, businessId });
    if (!customer) throw new Error('Cliente no encontrado');
    const business = await Business.findById(businessId);

    const compensating = -entry.delta;

    await Visit.create({
      customerId: entry.customerId,
      businessId,
      employeeId: new mongoose.Types.ObjectId(args.employeeId),
      type: 'REVERSAL',
      mechanic: entry.mechanic,
      delta: compensating,
      orderId: entry.orderId,
      orderTotal: entry.orderTotal,
      tableName: entry.tableName,
      reversesVisitId: entry._id,
    });

    if (entry.mechanic === 'sellos') {
      customer.stats.currentVisits = applyDelta(customer.stats.currentVisits, compensating);
      if (entry.type === 'ACCRUAL') {
        customer.stats.totalVisits = Math.max(0, customer.stats.totalVisits - 1);
      }
    } else {
      customer.stats.cashbackBalance = applyDelta(customer.stats.cashbackBalance, compensating);
      if (entry.type === 'ACCRUAL') {
        customer.stats.totalVisits = Math.max(0, customer.stats.totalVisits - 1);
      }
    }
    await customer.save();

    // A reversal is almost always an internal correction — a mistyped phone,
    // a wrong customer. Telling the cardholder raises a question at the
    // counter that nobody on shift can answer, so the pass updates in silence.
    if (business) syncWallet(customer, business, true);

    return { customer };
  },

  /** One page of a customer's history, newest first. Dashboard-only — the
   *  cardholder never sees this. */
  async history(customerId: string, businessId: string, page = 0, perPage = 10) {
    await dbConnect();
    const filter = {
      customerId: new mongoose.Types.ObjectId(customerId),
      businessId: new mongoose.Types.ObjectId(businessId),
    };

    const [entries, total] = await Promise.all([
      Visit.find(filter).sort({ createdAt: -1 }).skip(page * perPage).limit(perPage).lean(),
      Visit.countDocuments(filter),
    ]);

    // Which entries already carry a reversal, so the UI can hide the button.
    const reversedIds = new Set(
      (
        await Visit.find({
          reversesVisitId: { $in: entries.map((e) => e._id) },
        })
          .select('reversesVisitId')
          .lean()
      ).map((r) => String((r as unknown as IVisit).reversesVisitId))
    );

    return {
      entries: entries.map((e) => ({
        ...e,
        _id: String(e._id),
        reversed: reversedIds.has(String(e._id)),
      })),
      total,
      page,
      perPage,
      hasMore: (page + 1) * perPage < total,
    };
  },
};
