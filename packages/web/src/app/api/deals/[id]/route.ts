import { NextRequest, NextResponse } from "next/server";

import { createActivityForDeal, getDealWithRelations, updateDeal } from "@/lib/server/crm";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const deal = await getDealWithRelations(params.id);
    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    return NextResponse.json(deal);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load deal" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const updated = await updateDeal(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (body.stage) {
      await createActivityForDeal(params.id, {
        activity_type: "stage_changed",
        description: `Stage changed to ${body.stage}`,
        metadata: { new_stage: body.stage },
        created_by: "web",
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body" },
      { status: 400 },
    );
  }
}
