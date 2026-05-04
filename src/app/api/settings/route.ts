import { NextResponse } from "next/server";
import { getBotSettings, updateBotSettings } from "@/lib/db";

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
    await updateBotSettings(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    );
  }
}
