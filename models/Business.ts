import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITicketConfig {
  fiscalName?: string;   // Razón social
  rfc?: string;
  phone?: string;
  address?: string;
  fiscalAddress?: string;
  website?: string;
  footerMessage?: string;
  iva?: number;          // IVA rate %, prices already include it. 0 disables.
}

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
  ticket: ITicketConfig;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    branding: {
      logo: { type: String },
      primaryColor: { type: String, default: '#10b981' },
    },
    settings: {
      requiredVisits: { type: Number, default: 10 },
      rewardDescription: { type: String, required: true },
    },
    ticket: {
      fiscalName:    { type: String },
      rfc:           { type: String },
      phone:         { type: String },
      address:       { type: String },
      fiscalAddress: { type: String },
      website:       { type: String },
      footerMessage: { type: String, default: '¡Gracias por su visita!' },
      iva:           { type: Number, default: 16 },
    },
  },
  { timestamps: true }
);

const Business: Model<IBusiness> =
  mongoose.models.Business || mongoose.model<IBusiness>('Business', BusinessSchema);

export default Business;
