import { NextResponse } from "next/server";
import { getOrCreateConversation } from "@/lib/db";
import { processMessage } from "@/lib/core/message-processor";
import { isChannelEnabled } from "@/lib/channels";

export async function POST(request: Request) {
  if (!isChannelEnabled("webchat")) {
    return NextResponse.json({ error: "Canal WebChat no disponible en este plan" }, { status: 403 });
  }
  try {
    const { sessionId, name, message } = await request.json();

    if (!sessionId || !message?.trim()) {
      return NextResponse.json({ error: "sessionId y message son requeridos" }, { status: 400 });
    }

    const displayName = name?.trim() || "Visitante";
    let reply = "";

    const { conversation: convo, isNew } = await getOrCreateConversation(
      "webchat",
      sessionId,
      displayName
    );

    await processMessage({
      platform: "webchat",
      conversationId: convo.id,
      isNew,
      name: displayName,
      text: message.trim(),
      sendReply: async (text) => {
        reply = text;
      },
      onEscalation: async (clientName) => {
        console.log(`[webchat] Escalación de ${clientName} (${sessionId})`);
      },
    });

    return NextResponse.json({ reply: reply || null });
  } catch (err) {
    console.error("[api/chat] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
