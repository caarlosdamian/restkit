import Customer, { ICustomer } from "@/models/Customer";
import mongoose from "mongoose";

export const customerRepository = {
  async create(data: Partial<ICustomer>): Promise<ICustomer> {
    const customer = new Customer(data);
    return await customer.save();
  },

  /**
   * The roster. Archived customers are left out unless asked for by name —
   * the dashboard's "Archivados" filter is the only caller that wants them,
   * and everything else showing a deleted customer would be a bug.
   */
  async findByBusinessId(
    businessId: string,
    opts: { archived?: boolean } = {}
  ): Promise<ICustomer[]> {
    return await Customer.find({
      businessId: new mongoose.Types.ObjectId(businessId),
      // `$ne: true` rather than `false`, because every row that predates the
      // field has no `isActive` at all and must still count as active.
      ...(opts.archived ? { isActive: false } : { isActive: { $ne: false } }),
    }).sort({ createdAt: -1 });
  },

  async findById(id: string, businessId: string): Promise<ICustomer | null> {
    return await Customer.findOne({ 
      _id: new mongoose.Types.ObjectId(id),
      businessId: new mongoose.Types.ObjectId(businessId)
    });
  },

  async update(id: string, businessId: string, data: Partial<ICustomer>): Promise<ICustomer | null> {
    return await Customer.findOneAndUpdate(
      { 
        _id: new mongoose.Types.ObjectId(id),
        businessId: new mongoose.Types.ObjectId(businessId)
      },
      { $set: data },
      { new: true }
    );
  },

  /** Archive or restore. Returns the customer, or null if it is not theirs. */
  async setActive(id: string, businessId: string, isActive: boolean): Promise<ICustomer | null> {
    return await Customer.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        businessId: new mongoose.Types.ObjectId(businessId),
      },
      { $set: { isActive } },
      { new: true }
    );
  },

  /**
   * ⚠️ Hard delete. Nothing in the product calls this, and the dashboard
   * deliberately archives instead — a customer's `Visit` rows are the only
   * explanation for the programme's counters, and this leaves them pointing at
   * a row that no longer exists. Kept for scripts and tests only.
   */
  async delete(id: string, businessId: string): Promise<boolean> {
    const result = await Customer.deleteOne({ 
      _id: new mongoose.Types.ObjectId(id),
      businessId: new mongoose.Types.ObjectId(businessId)
    });
    return result.deletedCount === 1;
  }
};
