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

const Customer: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;
