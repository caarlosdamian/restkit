import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReward extends Document {
  name: string;
  description: string;
  visitsRequired: number;
  businessId: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RewardSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    visitsRequired: { type: Number, required: true },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Reward: Model<IReward> = mongoose.models.Reward || mongoose.model<IReward>('Reward', RewardSchema);

export default Reward;
