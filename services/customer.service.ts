import { customerRepository } from "@/repositories/customer.repository";
import dbConnect from "@/lib/db";
import { randomBytes } from "crypto";
import mongoose from "mongoose";

export const customerService = {
  async getAllCustomers(businessId: string) {
    await dbConnect();
    return await customerRepository.findByBusinessId(businessId);
  },

  async createCustomer(businessId: string, data: { name: string; email?: string; phone?: string }) {
    await dbConnect();
    return await customerRepository.create({
      ...data,
      businessId: new mongoose.Types.ObjectId(businessId),
      stats: { totalVisits: 0, currentVisits: 0, points: 0 },
      externalIds: { appleAuthToken: randomBytes(20).toString('hex') },
    });
  },

  async getCustomerById(id: string, businessId: string) {
    await dbConnect();
    return await customerRepository.findById(id, businessId);
  }
};
