import { NextResponse } from "next/server";
import { businessService } from "@/services/business.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { businessName, ownerId, ownerName, ownerEmail } = body;

    if (!businessName || !ownerId || !ownerName || !ownerEmail) {
      return Response.json(
        { error: "Faltan campos: businessName, ownerId, ownerName, ownerEmail" },
        { status: 400 }
      );
    }

    const business = await businessService.registerBusinessAndOwner({
      businessName,
      ownerId,
      ownerName,
      ownerEmail,
    });

    return Response.json({ success: true, business });
  } catch (error: any) {
    console.error("Error creating business:", error);
    console.error("Error stack:", error.stack);
    return Response.json(
      { error: error.message || "Error desconocido al crear negocio" },
      { status: 500 }
    );
  }
}
