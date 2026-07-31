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

export type PlanId = 'basic' | 'pro' | 'enterprise';
export type BillingPeriod = 'monthly' | 'annual';
/** trialing = in the free trial (no card). active = paid. past_due/canceled =
 *  needs to (re)subscribe. Missing/undefined on legacy docs = grandfathered
 *  (never gated) — see lib/subscription.ts. */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface ISubscription {
  plan?: PlanId;
  billingPeriod?: BillingPeriod;
  status?: SubscriptionStatus;
  /** End of the free trial (trial-without-card). Gate kicks in after this. */
  trialEndsAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** End of the current paid period (from Stripe) — access is valid until here. */
  currentPeriodEnd?: Date;
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
    /** What a single unit of progress is called, e.g. "visita", "compra", "sello". */
    unitSingular: string;
    unitPlural: string;
  };
  ticket: ITicketConfig;
  subscription: ISubscription;
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
      unitSingular: { type: String, default: 'visita' },
      unitPlural: { type: String, default: 'visitas' },
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
    subscription: {
      plan:                 { type: String, enum: ['basic', 'pro', 'enterprise'] },
      billingPeriod:        { type: String, enum: ['monthly', 'annual'] },
      status:               { type: String, enum: ['trialing', 'active', 'past_due', 'canceled'] },
      trialEndsAt:          { type: Date },
      stripeCustomerId:     { type: String, index: true },
      stripeSubscriptionId: { type: String },
      currentPeriodEnd:     { type: Date },
    },
  },
  { timestamps: true }
);

const Business: Model<IBusiness> =
  mongoose.models.Business || mongoose.model<IBusiness>('Business', BusinessSchema);

export default Business;
