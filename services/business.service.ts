import { businessRepository } from "@/repositories/business.repository";
import dbConnect from "@/lib/db";
import { auth } from "@/lib/auth";
import mongoose from "mongoose";

export const businessService = {
  async registerBusinessAndOwner(data: {
    businessName: string;
    ownerName: string;
    ownerEmail: string;
    ownerId: string; // From Better Auth
  }) {
    await dbConnect();

    // 1. Create Business
    const slug = data.businessName
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/[^\w-]+/g, "");

    const business = await businessRepository.create({
      name: data.businessName,
      slug,
      settings: {
        requiredVisits: 10,
        rewardDescription: "¡Un café gratis!",
      },
    });

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
