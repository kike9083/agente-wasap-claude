import { NextRequest, NextResponse } from "next/server";
import { setConnectionState } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export async function POST(_req: NextRequest) {
  setConnectionState({
    status: "disconnected",
    qr_string: null,
    phone: null,
  });

  const authDir = path.resolve(process.cwd(), "auth");
  try {
    fs.rmSync(authDir, { recursive: true, force: true });
  } catch {}

  const restartFlagPath = path.resolve(process.cwd(), "data/.restart");
  try {
    const dataDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(restartFlagPath, "");
  } catch {}

  return NextResponse.json({ ok: true });
}
