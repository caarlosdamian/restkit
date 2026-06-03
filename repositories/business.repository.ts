import Business, { IBusiness } from "@/models/Business";

export const businessRepository = {
  async create(data: Partial<IBusiness>): Promise<IBusiness> {
    const business = new Business(data);
    return await business.save();
  },

  async findBySlug(slug: string): Promise<IBusiness | null> {
    return await Business.findOne({ slug });
  },

  async findById(id: string): Promise<IBusiness | null> {
    return await Business.findById(id);
  },
};
