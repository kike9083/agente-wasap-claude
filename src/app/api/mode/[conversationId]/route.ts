import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setMode, getConversationById, createAuditLog } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;

  const convo = await getConversationById(conversationId);
  if (!convo) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const body = await req.json();
  const { mode } = body;

  if (!mode || (mode !== "AI" && mode !== "HUMAN" && mode !== "BANNED")) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value ?? "unknown";
    const userEmail = cookieStore.get("appwrite-user-email")?.value;

    const oldMode = convo.mode;
    await setMode(conversationId, mode);

    // Registrar cambio de modo en audit log con antes/después
    await createAuditLog({
      action: "mode.change",
      userId,
      userEmail,
      resourceType: "conversation",
      resourceId: conversationId,
      detail: JSON.stringify({ before: oldMode, after: mode }),
    });

    return NextResponse.json({ ok: true, mode });
  } catch (err) {
    console.error("Error setting mode:", err);
    return NextResponse.json({ error: "Failed to set mode" }, { status: 500 });
  }
}
