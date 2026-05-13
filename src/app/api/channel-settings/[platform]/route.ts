import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getChannelSettings, upsertChannelSettings, createAuditLog, type Platform } from "@/lib/db";
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
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value ?? "unknown";
    const userEmail = cookieStore.get("appwrite-user-email")?.value;

    const oldSettings = await getChannelSettings(platform as Platform);
    await upsertChannelSettings(platform as Platform, body);
    invalidateChannelCache(platform as Platform);

    // Registrar cambio en audit log con antes/después
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of Object.keys(body)) {
      const oldValue = oldSettings ? (oldSettings[key as keyof typeof oldSettings] ?? null) : null;
      if (oldValue !== body[key]) {
        changes[key] = {
          before: oldValue,
          after: body[key],
        };
      }
    }

    await createAuditLog({
      action: "channel_settings.update",
      userId,
      userEmail,
      resourceType: "channel_settings",
      resourceId: platform,
      detail: JSON.stringify({ platform, changes }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Error al guardar configuración del canal" }, { status: 500 });
  }
}
