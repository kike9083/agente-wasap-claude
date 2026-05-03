import { NextRequest, NextResponse } from "next/server";
import { setConnectionState, requestRestart } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export async function POST(_req: NextRequest) {
  await setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  const authDir = path.resolve(process.cwd(), "auth");
  try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}

  await requestRestart();

  return NextResponse.json({ ok: true });
}
