import { NextRequest, NextResponse } from "next/server";
import { setConnectionState, requestRestart } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export async function POST(_req: NextRequest) {
  await setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  // Borra archivos dentro de auth, no el directorio (es mount point en Docker)
  const authDir = path.resolve(process.cwd(), "auth");
  try {
    for (const f of fs.readdirSync(authDir)) {
      try { fs.unlinkSync(path.join(authDir, f)); } catch {}
    }
  } catch {}

  await requestRestart();

  return NextResponse.json({ ok: true });
}
