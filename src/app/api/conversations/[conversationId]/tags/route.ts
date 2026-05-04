import { NextResponse } from "next/server";
import { updateConversationTags } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { tags } = await req.json();
    if (!Array.isArray(tags)) {
      return NextResponse.json({ error: "tags debe ser array" }, { status: 400 });
    }
    // Normalizar: strings cortas, max 10 etiquetas
    const clean = tags
      .map((t) => String(t).trim().toLowerCase().slice(0, 30))
      .filter(Boolean)
      .slice(0, 10);

    await updateConversationTags(conversationId, clean);
    return NextResponse.json({ ok: true, tags: clean });
  } catch (err) {
    console.error("[api/conversations/[conversationId]/tags]", err);
    return NextResponse.json({ error: "Error al actualizar etiquetas" }, { status: 500 });
  }
}
