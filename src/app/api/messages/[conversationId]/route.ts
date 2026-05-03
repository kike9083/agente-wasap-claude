import { NextRequest, NextResponse } from "next/server";
import { getMessages, insertMessage, getConversationById, enqueueOutbox } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = parseInt(conversationId, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const messages = getMessages(id, 50);
  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = parseInt(conversationId, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const convo = getConversationById(id);
  if (!convo) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const body = await req.json();
  const { content, role } = body;

  if (!content || !role || (role !== "human" && role !== "user")) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const msg = insertMessage(id, role, content);

    if (role === "human") {
      enqueueOutbox(id, convo.phone, content);
    }

    return NextResponse.json({ ok: true, messageId: msg.id });
  } catch (err) {
    console.error("Error inserting message:", err);
    return NextResponse.json(
      { error: "Failed to insert message" },
      { status: 500 }
    );
  }
}
