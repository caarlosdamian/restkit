import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Order, { IOrderItem } from '@/models/Order';
import Table from '@/models/Table';
import dbConnect from '@/lib/db';
import mongoose from 'mongoose';
import { getBusinessContext } from '@/lib/pos-auth';
import { verifyWaiterToken, signWaiterToken } from '@/lib/waiter-token';
import { inventoryService } from '@/services/inventory.service';
import { loyaltyService } from '@/services/loyalty.service';
import Customer from '@/models/Customer';
import Business from '@/models/Business';
import { loyaltyConfig, stampState } from '@/lib/loyalty';
import { qrDataUrl } from '@/lib/qr';
import { appUrl } from '@/lib/app-url';

type Params = Promise<{ orderId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { orderId } = await params;
  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    businessId: ctx.businessId,
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const ctx = await getBusinessContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { orderId } = await params;
  const body = await req.json();

  const order = await Order.findOne({
    _id: new mongoose.Types.ObjectId(orderId),
    businessId: ctx.businessId,
  });
  if (!order) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

  // Acting waiter from the PIN token, or the logged-in terminal user.
  const hdrs = await headers();
  const waiter = verifyWaiterToken(hdrs.get('x-waiter-token'), ctx.businessIdStr);
  const actingStaffId = new mongoose.Types.ObjectId(waiter?.staffId ?? ctx.userId);

  if (body.items !== undefined) {
    // Preserve who first added each existing line, and how much the kitchen has
    // already prepared, so attribution + KDS progress survive a full items
    // replace. preparedQty is capped at the (possibly reduced) new quantity;
    // extra units added in a later round re-appear as pending on the KDS.
    const prevById = new Map(
      order.items.map((i) => [String(i.productId), { addedBy: i.addedBy, preparedQty: i.preparedQty ?? 0 }])
    );
    order.items = body.items.map((i: IOrderItem) => {
      const prev = prevById.get(String(i.productId));
      return {
        ...i,
        addedBy: prev?.addedBy ?? actingStaffId,
        preparedQty: Math.min(prev?.preparedQty ?? 0, i.quantity),
      };
    });
    order.total = body.items.reduce(
      (sum: number, i: IOrderItem) => sum + i.price * i.quantity,
      0
    );
  }

  // Attaching the loyalty customer is allowed right up to payment, and is the
  // only moment the cashier has both the bill and the customer's attention.
  if (body.customerId !== undefined) {
    order.customerId = body.customerId
      ? new mongoose.Types.ObjectId(String(body.customerId))
      : undefined;
  }

  // Set once below if this request is the one that flips the order to PAID,
  // so we deduct inventory exactly once, after the order itself is saved.
  let deductInventory = false;
  // Likewise for loyalty: the ledger's unique index is the real guard, this
  // just avoids the round-trip on every other PATCH.
  let accrueLoyalty = false;

  if (body.status) {
    order.status = body.status;
    // First time the ticket reaches the kitchen → stamp the aging clock.
    if (body.status === 'IN_KITCHEN' && !order.kitchenAt) {
      order.kitchenAt = new Date();
    }
    if (body.status === 'PAID') {
      // Generate a short ticket number from the ObjectId
      order.ticketNumber = order._id.toString().slice(-6).toUpperCase();
      if (body.paymentMethod) order.paymentMethod = body.paymentMethod;

      // Cashback spent on this bill. `total` stays gross; the customer owes
      // the difference, and that difference is what the drawer expects.
      if (order.customerId && body.cashbackApplied != null) {
        try {
          order.cashbackApplied = await loyaltyService.redeemCashback({
            customerId: String(order.customerId),
            businessId: ctx.businessIdStr,
            employeeId: String(actingStaffId),
            orderTotal: order.total,
            requested: Number(body.cashbackApplied),
            orderId: order._id,
          });
        } catch (err) {
          console.error('Cashback redemption failed for order', String(order._id), err);
        }
      }

      // Claiming a completed stamp card.
      if (order.customerId && body.redeemReward) {
        try {
          await loyaltyService.redeemReward({
            customerId: String(order.customerId),
            businessId: ctx.businessIdStr,
            employeeId: String(actingStaffId),
            orderId: order._id,
          });
          order.rewardRedeemed = true;
        } catch (err) {
          console.error('Reward redemption failed for order', String(order._id), err);
        }
      }

      const due = Math.max(0, order.total - (order.cashbackApplied ?? 0));
      if (body.amountReceived != null) {
        order.amountReceived = Number(body.amountReceived);
        order.change = Math.max(0, Number(body.amountReceived) - due);
      }
      // Guard against double-deduction if PAID is re-applied (e.g. a retried PATCH).
      if (!order.inventoryDeducted) {
        deductInventory = true;
        order.inventoryDeducted = true;
      }
      if (order.customerId) accrueLoyalty = true;
    }
    // Free the table when the order closes (paid or cancelled).
    if (body.status === 'PAID' || body.status === 'CANCELLED') {
      order.closedAt = new Date();
      await Table.updateOne(
        { _id: order.tableId },
        { $set: { isOccupied: false }, $unset: { assignedStaffId: '' } }
      );
    }
  }

  if (body.notes !== undefined) order.notes = body.notes;

  await order.save();

  if (deductInventory) {
    // Only products with a recipe touch inventory; failures here must not
    // block a payment that already succeeded, so log and move on.
    try {
      await inventoryService.deductForOrder(
        ctx.businessId,
        order._id,
        order.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity }))
      );
    } catch (err) {
      console.error('Inventory deduction failed for order', String(order._id), err);
    }
  }

  // After the order is safely saved: a loyalty failure must never fail a
  // payment that already went through.
  let loyalty = null;
  if (accrueLoyalty && order.customerId) {
    try {
      const result = await loyaltyService.accrueForOrder({
        customerId: String(order.customerId),
        businessId: ctx.businessIdStr,
        employeeId: String(actingStaffId),
        orderId: order._id,
        orderTotal: order.total,
        tableName: order.tableName,
      });

      if (result) {
        // The card link goes on the ticket, so a walk-in enrolled at the
        // register leaves with a way to add the pass.
        const customer = await Customer.findById(order.customerId).select('publicToken');
        const business = await Business.findById(ctx.businessId).select('settings');
        const config = loyaltyConfig(business);
        const base = appUrl();
        const cardUrl = customer ? `${base}/c/${customer.publicToken}` : undefined;

        loyalty = {
          ...result,
          required: config.sellos.required,
          stamps: stampState(result.currentVisits, config.sellos.required).stamps,
          rewardDescription: config.sellos.rewardDescription,
          unitPlural: config.sellos.unitPlural,
          cardUrl,
          qrDataUrl: cardUrl ? await qrDataUrl(cardUrl, 160) : undefined,
        };
      }
    } catch (err) {
      console.error('Loyalty accrual failed for order', String(order._id), err);
    }
  }

  const res = NextResponse.json(loyalty ? { ...order.toObject(), loyalty } : order);
  if (waiter) {
    res.headers.set(
      'x-waiter-token',
      signWaiterToken(waiter.staffId, waiter.staffName, ctx.businessIdStr)
    );
  }
  return res;
}
