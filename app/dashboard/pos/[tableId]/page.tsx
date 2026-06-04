import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Table from "@/models/Table";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { businessRepository } from "@/repositories/business.repository";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import OrderBuilder from "@/components/pos/OrderBuilder";

export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  await dbConnect();
  const bId = new mongoose.Types.ObjectId(session.user.businessId);

  const [table, activeOrder, products, business] = await Promise.all([
    Table.findOne({ _id: tableId, businessId: bId, isActive: true }),
    Order.findOne({
      tableId,
      businessId: bId,
      status: { $in: ["OPEN", "IN_KITCHEN", "READY"] },
    }),
    Product.find({ businessId: bId }).sort({ category: 1, sortOrder: 1, name: 1 }),
    businessRepository.findById(session.user.businessId),
  ]);

  if (!table) notFound();

  const serializedOrder = activeOrder
    ? {
        _id: activeOrder._id.toString(),
        status: activeOrder.status,
        total: activeOrder.total,
        items: activeOrder.items.map((item) => ({
          productId: item.productId.toString(),
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          notes: item.notes,
        })),
      }
    : null;

  return (
    <div className="h-full flex flex-col">
      <OrderBuilder
        tableId={tableId}
        tableName={table.name || `Mesa ${table.number}`}
        businessName={business?.name || "RestKit"}
        staffName={session.user.name}
        ticketConfig={business?.ticket ? {
          fiscalName:    business.ticket.fiscalName,
          rfc:           business.ticket.rfc,
          phone:         business.ticket.phone,
          address:       business.ticket.address,
          fiscalAddress: business.ticket.fiscalAddress,
          website:       business.ticket.website,
          footerMessage: business.ticket.footerMessage,
        } : {}}
        products={products.map((p) => ({
          _id: p._id.toString(),
          name: p.name,
          description: p.description,
          price: p.price,
          category: p.category,
          isAvailable: p.isAvailable,
        }))}
        initialOrder={serializedOrder}
      />
    </div>
  );
}
