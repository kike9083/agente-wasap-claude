import { NextRequest, NextResponse } from "next/server";
import { setMode, getConversationById } from "@/lib/db";

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
    await setMode(conversationId, mode);
    return NextResponse.json({ ok: true, mode });
  } catch (err) {
    console.error("Error setting mode:", err);
    return NextResponse.json({ error: "Failed to set mode" }, { status: 500 });
  }
}
