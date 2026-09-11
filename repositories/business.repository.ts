import Business, { IBusiness } from "@/models/Business";
import dbConnect from "@/lib/db";

/**
 * ⚠️ Every method connects first, unlike the other repositories.
 *
 * This is the one repository that pages and route handlers call DIRECTLY rather
 * than through a service, and three dashboard pages call it inside a
 * `Promise.all` alongside a service that does its own `dbConnect()`:
 *
 *     Promise.all([customerService.getAllCustomers(id), businessRepository.findById(id)])
 *
 * `Promise.all` starts both at once, so on a cold serverless instance the query
 * here went out while the service was still opening the connection, and
 * `bufferCommands: false` turned that into a hard throw:
 *
 *     Cannot call `businesses.findOne()` before initial connection is complete
 *
 * A warm instance already has the connection, so it only ever failed on the
 * first request an instance served — which read as "sometimes", and as "fixed
 * by reloading" when the retry landed somewhere warm.
 *
 * `dbConnect()` is cached and idempotent: once connected it is a property read,
 * so this costs nothing on the warm path.
 */
export const businessRepository = {
  async create(data: Partial<IBusiness>): Promise<IBusiness> {
    await dbConnect();
    const business = new Business(data);
    return await business.save();
  },

  async findBySlug(slug: string): Promise<IBusiness | null> {
    await dbConnect();
    return await Business.findOne({ slug });
  },

  async findById(id: string): Promise<IBusiness | null> {
    await dbConnect();
    return await Business.findById(id);
  },
};
