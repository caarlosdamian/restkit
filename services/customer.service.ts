import { customerRepository } from "@/repositories/customer.repository";
import { newPublicToken } from "@/models/Customer";
import dbConnect from "@/lib/db";
import { randomBytes } from "crypto";
import mongoose from "mongoose";

export const customerService = {
  async getAllCustomers(businessId: string, opts: { archived?: boolean } = {}) {
    await dbConnect();
    return await customerRepository.findByBusinessId(businessId, opts);
  },

  async createCustomer(businessId: string, data: { name: string; email?: string; phone?: string }) {
    await dbConnect();
    return await customerRepository.create({
      ...data,
      businessId: new mongoose.Types.ObjectId(businessId),
      stats: { totalVisits: 0, currentVisits: 0, cashbackBalance: 0 },
      publicToken: newPublicToken(),
      externalIds: { appleAuthToken: randomBytes(20).toString('hex') },
    });
  },

  async getCustomerById(id: string, businessId: string) {
    await dbConnect();
    return await customerRepository.findById(id, businessId);
  },

  async updateCustomer(
    id: string,
    businessId: string,
    data: { name?: string; email?: string; phone?: string }
  ) {
    await dbConnect();
    return await customerRepository.update(id, businessId, data);
  },

  /**
   * Take a customer out of the programme without destroying what they did in
   * it. They leave the roster, the till lookup and the scanner; their `Visit`
   * ledger and their cashback balance are untouched, so the history still
   * explains every number and restoring them brings the balance back exactly
   * as it was.
   */
  async archiveCustomer(id: string, businessId: string) {
    await dbConnect();
    return await customerRepository.setActive(id, businessId, false);
  },

  async restoreCustomer(id: string, businessId: string) {
    await dbConnect();
    return await customerRepository.setActive(id, businessId, true);
  },
};
