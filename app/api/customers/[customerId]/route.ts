import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { customerService } from "@/services/customer.service";

type Params = Promise<{ customerId: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { customerId } = await params;
    const body = await req.json();

    const customer = await customerService.updateCustomer(customerId, session.user.businessId, {
      name: body.name,
      email: body.email,
      phone: body.phone,
    });

    if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    return NextResponse.json(customer);
  } catch (error: any) {
    console.error("Error updating customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
