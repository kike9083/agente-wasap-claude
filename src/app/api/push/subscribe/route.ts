import { NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push";

export async function POST(req: Request) {
  try {
    const sub = await req.json();
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: "Suscripción inválida" }, { status: 400 });
    }
    saveSubscription(sub);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push/subscribe]", err);
    return NextResponse.json({ error: "Error al guardar suscripción" }, { status: 500 });
  }
}
