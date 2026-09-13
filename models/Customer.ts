import mongoose, { Schema, Document, Model } from 'mongoose';
import { randomBytes } from 'crypto';

export interface ICustomer extends Document {
  name: string;
  email?: string;
  phone?: string;
  businessId: mongoose.Types.ObjectId;
  stats: {
    totalVisits: number;
    /** Stamps since the last redeemed reward. May exceed the required count
     *  when rewards are earned faster than they're claimed — lib/loyalty.ts
     *  derives pending rewards and displayed progress from this one number. */
    currentVisits: number;
    /** Redeemable cashback in MXN. */
    cashbackBalance: number;
  };
  /** Unguessable id for the public card page. Kept separate from
   *  appleAuthToken, which is a PassKit credential and must not travel in a URL. */
  publicToken: string;
  externalIds: {
    applePassId?: string;
    appleAuthToken?: string;
    googlePassId?: string;
  };
  /**
   * False once the owner archives them. Archiving is how a customer is
   * "deleted" from the dashboard: they leave the roster, the till lookup and
   * the scanner, and their pass stops changing because nothing can accrue
   * against them any more.
   *
   * Not a hard delete, and deliberately so. `Visit` is an append-only ledger
   * and the only explanation for any counter; removing the person it belongs
   * to would leave the numbers with nothing behind them and quietly erase a
   * cashback balance the business still owed. Archiving keeps the history and
   * stays reversible, exactly like `Table.isActive`.
   */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function newPublicToken(): string {
  return randomBytes(20).toString('hex');
}

const CustomerSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, index: true },
    phone: { type: String, index: true },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    stats: {
      totalVisits: { type: Number, default: 0 },
      currentVisits: { type: Number, default: 0 },
      cashbackBalance: { type: Number, default: 0 },
    },
    publicToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: newPublicToken,
    },
    externalIds: {
      applePassId: { type: String },
      appleAuthToken: { type: String },
      googlePassId: { type: String },
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Unique per business by email or phone, but only for customers that actually
// have one. `sparse` is not enough: a document storing an explicit null still
// gets indexed, so a second phone-only walk-in collided with the first on
// (businessId, null). A partial index skips the field unless it's a string.
CustomerSchema.index(
  { businessId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
CustomerSchema.index(
  { businessId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);

// ⚠️ Those two uniques deliberately do NOT exclude archived customers. An
// archived person keeps their phone number reserved, so re-enrolling the same
// number at /j/[slug] still answers ALREADY_ENROLLED rather than minting a
// second card for one human. Restoring them from the dashboard is the way
// back, which is the whole reason archiving is reversible.

const Customer: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;
