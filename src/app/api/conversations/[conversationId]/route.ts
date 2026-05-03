import { NextRequest, NextResponse } from "next/server";
import { deleteConversation } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;

  if (!conversationId) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    await deleteConversation(conversationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting conversation:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
