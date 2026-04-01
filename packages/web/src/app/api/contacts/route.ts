import { NextResponse } from "next/server";

import { listContacts } from "@/lib/server/crm";

export async function GET() {
  try {
    const contacts = await listContacts();
    return NextResponse.json(contacts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load contacts" },
      { status: 500 },
    );
  }
}
