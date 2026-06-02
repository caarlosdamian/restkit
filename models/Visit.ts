import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVisit extends Document {
  customerId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  type: 'VISIT' | 'REWARD_REDEMPTION';
  timestamp: Date;
}

const VisitSchema: Schema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['VISIT', 'REWARD_REDEMPTION'],
      default: 'VISIT',
    },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Visit: Model<IVisit> = mongoose.models.Visit || mongoose.model<IVisit>('Visit', VisitSchema);

export default Visit;
