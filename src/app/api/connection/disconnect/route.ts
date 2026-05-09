import { NextRequest, NextResponse } from "next/server";
import { setConnectionState, requestRestart } from "@/lib/db";
import { clearAuthContents } from "@/lib/baileys/client";
import path from "node:path";

export async function POST(_req: NextRequest) {
  await setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  // Borra solo el contenido de auth, no el directorio (es mount point en Docker)
  const authDir = path.resolve(process.cwd(), "auth");
  clearAuthContents(authDir);

  await requestRestart();

  return NextResponse.json({ ok: true });
}
