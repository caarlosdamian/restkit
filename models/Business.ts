import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBusiness extends Document {
  name: string;
  slug: string;
  branding: {
    logo?: string;
    primaryColor: string;
  };
  settings: {
    requiredVisits: number;
    rewardDescription: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    branding: {
      logo: { type: String },
      primaryColor: { type: String, default: '#000000' },
    },
    settings: {
      requiredVisits: { type: Number, default: 10 },
      rewardDescription: { type: String, required: true },
    },
  },
  { timestamps: true }
);

const Business: Model<IBusiness> = mongoose.models.Business || mongoose.model<IBusiness>('Business', BusinessSchema);

export default Business;
