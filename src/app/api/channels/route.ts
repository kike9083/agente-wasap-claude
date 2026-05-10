import { NextResponse } from "next/server";
import { getEnabledChannels } from "@/lib/channels";

export async function GET() {
  return NextResponse.json({ channels: getEnabledChannels() });
}
