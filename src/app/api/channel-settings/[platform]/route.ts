import { NextRequest, NextResponse } from "next/server";
import { getChannelSettings, upsertChannelSettings, type Platform } from "@/lib/db";
import { invalidateChannelCache } from "@/lib/system-prompt";

const VALID_PLATFORMS: Platform[] = ["whatsapp", "telegram", "webchat"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  try {
    const settings = await getChannelSettings(platform as Platform);
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: "Error al obtener configuración del canal" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  try {
    const body = await req.json();
    await upsertChannelSettings(platform as Platform, body);
    invalidateChannelCache(platform as Platform);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al guardar configuración del canal" }, { status: 500 });
  }
}
