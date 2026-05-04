import { NextResponse } from "next/server";
import { removeSubscription } from "@/lib/push";

export async function POST(req: Request) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "Falta endpoint" }, { status: 400 });
    removeSubscription(endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/unsubscribe]", err);
    return NextResponse.json({ error: "Error al eliminar suscripción" }, { status: 500 });
  }
}
