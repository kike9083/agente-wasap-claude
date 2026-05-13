import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteConversation, createAuditLog, getConversationById } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;

  if (!conversationId) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value ?? "unknown";
    const userEmail = cookieStore.get("appwrite-user-email")?.value;

    const conversation = await getConversationById(conversationId);

    await deleteConversation(conversationId);

    // Registrar eliminación en audit log con información de lo eliminado
    await createAuditLog({
      action: "conversation.delete",
      userId,
      userEmail,
      resourceType: "conversation",
      resourceId: conversationId,
      detail: conversation ? JSON.stringify({
        name: conversation.name,
        platform: conversation.platform,
        externalId: conversation.externalId,
      }) : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting conversation:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
