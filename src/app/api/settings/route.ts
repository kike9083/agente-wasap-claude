import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBotSettings, updateBotSettings, createAuditLog } from "@/lib/db";
import { invalidateChannelCache } from "@/lib/system-prompt";

export async function GET() {
  try {
    const settings = await getBotSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value ?? "unknown";
    const userEmail = cookieStore.get("appwrite-user-email")?.value;

    console.log("[API /api/settings] POST request body:", JSON.stringify({
      escalation_agents: body.escalation_agents,
      escalation_agent_index: body.escalation_agent_index,
    }));

    const oldSettings = await getBotSettings();
    await updateBotSettings(body);

    // Invalidate cache so bot picks up new settings immediately
    invalidateChannelCache();

    console.log("[API /api/settings] Settings updated successfully");

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
      action: "settings.update",
      userId,
      userEmail,
      resourceType: "bot_settings",
      detail: JSON.stringify({ changes }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    );
  }
}
