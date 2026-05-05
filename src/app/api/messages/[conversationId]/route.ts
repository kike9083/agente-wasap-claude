import { NextRequest, NextResponse } from "next/server";
import { getMessages, insertMessage, getConversationById, enqueueOutbox } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const messages = await getMessages(conversationId, 50);
  return NextResponse.json({ messages: messages.reverse() });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;

  const convo = await getConversationById(conversationId);
  if (!convo) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const body = await req.json();
  const { content, role } = body;

  if (!content || !role || (role !== "human" && role !== "user")) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const msg = await insertMessage(conversationId, role, content);

    if (role === "human" && convo.phone) {
      await enqueueOutbox(conversationId, convo.phone, content);
    }

    return NextResponse.json({ ok: true, messageId: msg.id });
  } catch (err) {
    console.error("Error inserting message:", err);
    return NextResponse.json({ error: "Failed to insert message" }, { status: 500 });
  }
}
