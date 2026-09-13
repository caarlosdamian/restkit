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

    // Restoring is a PATCH rather than its own verb: it is the exact inverse of
    // the DELETE below, on the same resource.
    if (body.isActive === true) {
      const restored = await customerService.restoreCustomer(customerId, session.user.businessId);
      if (!restored) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      return NextResponse.json(restored);
    }

    const customer = await customerService.updateCustomer(customerId, session.user.businessId, {
      name: body.name,
      email: body.email,
      phone: body.phone,
    });

    if (!customer) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    return NextResponse.json(customer);
  } catch (error: unknown) {
    // ⚠️ A phone or email is unique per business, so editing one onto a number
    // another customer already has is an ordinary mistake, not a server fault.
    // Reported as a 500 it reads as "the app is broken" and the owner retries
    // the same thing forever. Which index collided decides the wording.
    const mongoError = error as { code?: number; keyPattern?: unknown; keyValue?: unknown };
    if (mongoError?.code === 11000) {
      const onPhone = JSON.stringify(
        mongoError.keyPattern ?? mongoError.keyValue ?? {}
      ).includes("phone");
      return NextResponse.json(
        {
          error: onPhone
            ? "Otro cliente ya tiene ese teléfono."
            : "Otro cliente ya tiene ese correo.",
          code: "DUPLICATE_CONTACT",
        },
        { status: 409 }
      );
    }
    console.error("Error updating customer:", error);
    const message = error instanceof Error ? error.message : "Error al actualizar el cliente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Archive — what "eliminar cliente" does in the dashboard.
 *
 * ⚠️ Deliberately NOT a hard delete. `Visit` is an append-only ledger and the
 * only thing that explains the programme's counters; dropping the customer it
 * belongs to would leave "premios entregados" and every past cash-up describing
 * a person who is not there, and would silently wipe a cashback balance the
 * business still owed. Archiving takes them out of the roster, the till lookup
 * and the scanner, leaves the history alone, and is undone by
 * `PATCH { isActive: true }`.
 */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Same roles that may edit the menu and the staff list. A waiter on the
    // terminal has no dashboard at all, but this is the gate that says so.
    if (!["OWNER", "ADMIN"].includes(session.user.role as string)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { customerId } = await params;
    const archived = await customerService.archiveCustomer(customerId, session.user.businessId);
    if (!archived) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    return NextResponse.json({ ok: true, customer: archived });
  } catch (error: unknown) {
    console.error("Error archiving customer:", error);
    const message = error instanceof Error ? error.message : "Error al eliminar el cliente";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
