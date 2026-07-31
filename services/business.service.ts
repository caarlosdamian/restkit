import { businessRepository } from "@/repositories/business.repository";
import dbConnect from "@/lib/db";
import { auth } from "@/lib/auth";
import mongoose from "mongoose";
import { TRIAL_DAYS, toSelfServePlanId, toBillingPeriod } from "@/lib/plans";

export const businessService = {
  async registerBusinessAndOwner(data: {
    businessName: string;
    ownerName: string;
    ownerEmail: string;
    ownerId: string; // From Better Auth
    /** Plan chosen on the pricing page, carried through signup. Optional. */
    plan?: string;
    billingPeriod?: string;
  }) {
    await dbConnect();

    // Every new business starts a 14-day trial with no card (trial-without-card).
    // The gate only kicks in once trialEndsAt passes and they haven't paid.
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const selectedPlan = toSelfServePlanId(data.plan) ?? "pro";

    // 1. Create Business with unique slug
    let slug = data.businessName
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^\w-]+/g, "");

    // Ensure slug is unique by appending random suffix if needed
    const existingSlug = await businessRepository.findBySlug(slug);
    if (existingSlug) {
      slug = `${slug}-${Math.random().toString(36).substr(2, 6)}`;
    }

    let business;
    try {
      const businessData = {
        name: data.businessName,
        slug: slug || `business-${Date.now()}`,
        branding: {
          primaryColor: '#10b981',
          logo: undefined,
        },
        settings: {
          requiredVisits: 10,
          rewardDescription: "¡Un café gratis!",
          unitSingular: "visita",
          unitPlural: "visitas",
        },
        ticket: {
          fiscalName: data.businessName,
          rfc: undefined,
          phone: undefined,
          address: undefined,
          fiscalAddress: undefined,
          website: undefined,
          footerMessage: '¡Gracias por tu visita!',
        },
        subscription: {
          plan: selectedPlan,
          billingPeriod: toBillingPeriod(data.billingPeriod),
          status: 'trialing' as const,
          trialEndsAt,
        },
      };

      console.log("Creating business with data:", businessData);
      business = await businessRepository.create(businessData);
      console.log("Business created successfully:", business._id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Business creation error:", error);
      console.error("Error details:", error.message, error.errors);
      throw new Error(`No se pudo crear el negocio: ${error.message}`);
    }

    // 2. Link owner to business in Better Auth database
    // We update the user collection directly using Mongoose.
    // Why? Better Auth's `auth.api.updateUser` validates fields for security and strips out
    // restricted custom fields like `role` and `businessId` to prevent users from escalating
    // their own privileges via the client API. Since this is a trusted server-side action,
    // a direct database update is the recommended way to bypass these client protections.
    try {
      await mongoose.connection.collection("user").updateOne(
        { _id: new mongoose.Types.ObjectId(data.ownerId) },
        {
          $set: {
            role: "OWNER",
            businessId: business._id.toString(),
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      console.error("Error updating user:", error);
    }

    return business;
  },
};
