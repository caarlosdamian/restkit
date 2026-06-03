import Customer, { ICustomer } from "@/models/Customer";
import mongoose from "mongoose";

export const customerRepository = {
  async create(data: Partial<ICustomer>): Promise<ICustomer> {
    const customer = new Customer(data);
    return await customer.save();
  },

  async findByBusinessId(businessId: string): Promise<ICustomer[]> {
    return await Customer.find({ businessId: new mongoose.Types.ObjectId(businessId) }).sort({ createdAt: -1 });
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

  async delete(id: string, businessId: string): Promise<boolean> {
    const result = await Customer.deleteOne({ 
      _id: new mongoose.Types.ObjectId(id),
      businessId: new mongoose.Types.ObjectId(businessId)
    });
    return result.deletedCount === 1;
  }
};
