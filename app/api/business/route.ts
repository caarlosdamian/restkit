import { NextResponse } from "next/navigation";
import { businessService } from "@/services/business.service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { businessName, ownerId, ownerName, ownerEmail } = body;

    const business = await businessService.registerBusinessAndOwner({
      businessName,
      ownerId,
      ownerName,
      ownerEmail,
    });

    return Response.json({ success: true, business });
  } catch (error: any) {
    console.error("Error creating business:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
