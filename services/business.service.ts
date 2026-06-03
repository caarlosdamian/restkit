import { auth } from "@/lib/auth";
import { businessRepository } from "@/repositories/business.repository";
import dbConnect from "@/lib/db";

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
    // Better Auth allows updating user data. We use the internal database methods.
    await auth.api.updateUser({
        body: {
            userId: data.ownerId,
            data: {
                role: "OWNER",
                businessId: business._id.toString(),
            }
        }
    });

    return business;
  },
};
