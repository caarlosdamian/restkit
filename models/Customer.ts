import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email?: string;
  phone?: string;
  businessId: mongoose.Types.ObjectId;
  stats: {
    totalVisits: number;
    currentVisits: number; // Visits since last reward
    points: number;
  };
  externalIds: {
    applePassId?: string;
    googlePassId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
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
      points: { type: Number, default: 0 },
    },
    externalIds: {
      applePassId: { type: String },
      googlePassId: { type: String },
    },
  },
  { timestamps: true }
);

// Unique customer per business by email or phone if provided
CustomerSchema.index({ businessId: 1, email: 1 }, { unique: true, sparse: true });
CustomerSchema.index({ businessId: 1, phone: 1 }, { unique: true, sparse: true });

const Customer: Model<ICustomer> = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;
