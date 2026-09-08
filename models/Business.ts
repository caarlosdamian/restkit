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

export type PlanId = 'lite' | 'basic' | 'pro';
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

/** Which earning model the business runs. Exactly one is active at a time;
 *  switching freezes the other side's progress rather than clearing it. */
export type LoyaltyMechanic = 'sellos' | 'cashback';

import type { CardFieldConfig } from '@/lib/card-fields';

/** The card ground. A photo (`card.stripImage`) overrides whichever is set. */
export type CardGround = 'light' | 'brand' | 'dark';

/** How a single stamp is drawn on that ground. */
export type StampStyle = 'plain' | 'filled' | 'outline';

/**
 * Where `card.stripImage` goes.
 *
 * `background` puts it behind the stamps, `side` beside them inside the same
 * band, `footer` in a band of its own below the card.
 *
 * ⚠️ Apple gives a storeCard exactly one image band — `strip.png`. `footer.png`
 * is boardingPass-only and `background.png` is eventTicket-only, so `footer`
 * simply has nowhere to render on an Apple pass; Google (`imageModulesData`)
 * and the web card both show it. The wallet form says so rather than letting an
 * owner design something one of their two platforms silently drops.
 */
export type PhotoPlacement = 'background' | 'side' | 'footer';

export interface ILoyaltyConfig {
  mechanic: LoyaltyMechanic;
  sellos: {
    /** Stamps needed for one reward. */
    required: number;
    rewardDescription: string;
    /** What one unit of progress is called — "visita", "compra", "sello". */
    unitSingular: string;
    unitPlural: string;
    /** Anti-farming guards, both off by default. A business that doesn't care
     *  leaves them unset; turning them on is a settings change, not a migration. */
    minTicket?: number;
    maxPerDay?: number;
  };
  cashback: {
    /** Percent of each paid order accrued as balance. */
    rate: number;
    /** Balance must reach this before it can be spent — what makes it feel
     *  like saving up rather than pocket change. */
    threshold: number;
    /** Inactivity expiry in days. Unset = never expires (the current policy);
     *  present so a policy can be added later without a migration. */
    expiryDays?: number;
  };
  card: {
    /** What the stamps sit on. `light` is a white card, `brand` paints the
     *  ground in the business colour, `dark` in a deep version of that hue.
     *  A `stripImage` overrides all three. */
    ground: CardGround;
    /** How each stamp is drawn. `filled` is the punch-card look — a solid
     *  badge with the icon knocked out of it — and reads at arm's length in a
     *  way a bare stroked icon does not. */
    stampStyle: StampStyle;
    /** Which fields sit in which slot on the wallet pass. Slots and their
     *  limits are platform constraints — see lib/card-layout.ts. */
    fields?: CardFieldConfig;
    /** Icon id from the catalog in lib/stamp-icons.ts. */
    stampIcon: string;
    /** Uploaded icon, overrides stampIcon when set. */
    customIconUrl?: string;
    /** Photo of the place. `photoPlacement` decides where it goes. */
    stripImage?: string;
    photoPlacement: PhotoPlacement;
    /** Card ground. Falls back to branding.primaryColor when unset. */
    bgColor?: string;
  };
  /** Geofence for the Wallet pass (Fase 3). Unset = no location relevance. */
  location?: {
    latitude: number;
    longitude: number;
    relevantText?: string;
  };
}

export interface IBusiness extends Document {
  name: string;
  slug: string;
  branding: {
    logo?: string;
    primaryColor: string;
  };
  settings: {
    loyalty: ILoyaltyConfig;
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
      loyalty: {
        mechanic: { type: String, enum: ['sellos', 'cashback'], default: 'sellos' },
        sellos: {
          required:          { type: Number, default: 10 },
          rewardDescription: { type: String, default: 'Un premio gratis' },
          unitSingular:      { type: String, default: 'visita' },
          unitPlural:        { type: String, default: 'visitas' },
          minTicket:         { type: Number },
          maxPerDay:         { type: Number },
        },
        cashback: {
          rate:       { type: Number, default: 5 },
          threshold:  { type: Number, default: 100 },
          expiryDays: { type: Number },
        },
        card: {
          ground:        { type: String, enum: ['light', 'brand', 'dark'], default: 'light' },
          stampStyle:    { type: String, enum: ['plain', 'filled', 'outline'], default: 'filled' },
          stampIcon:     { type: String, default: 'star' },
          fields: {
            header:    { type: [String] },
            secondary: { type: [String] },
            auxiliary: { type: [String] },
          },
          customIconUrl: { type: String },
          stripImage:    { type: String },
          photoPlacement: {
            type: String,
            enum: ['background', 'side', 'footer'],
            default: 'background',
          },
          bgColor:       { type: String },
        },
        location: {
          latitude:     { type: Number },
          longitude:    { type: Number },
          relevantText: { type: String },
        },
      },
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
      plan:                 { type: String, enum: ['lite', 'basic', 'pro'] },
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
