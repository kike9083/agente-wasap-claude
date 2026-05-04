import { NextRequest, NextResponse } from "next/server";
import { getConnectionState } from "@/lib/db";
import QRCode from "qrcode";

export async function GET(_req: NextRequest) {
  const state = await getConnectionState();

  // WhatsApp expira el QR en ~20s. Si tiene más de 25s lo tratamos como obsoleto.
  const qrAgeSec = Math.floor(Date.now() / 1000) - (state.updated_at ?? 0);
  const shouldShowQr =
    !!state.qr_string &&
    (state.status === "qr" || state.status === "connecting") &&
    qrAgeSec < 25;

  if (shouldShowQr && state.qr_string) {
    try {
      const qrPng = await QRCode.toDataURL(state.qr_string, {
        width: 320,
        margin: 2,
      });
      return NextResponse.json({ status: "qr", qrPng, updatedAt: state.updated_at });
    } catch (err) {
      console.error("Error generating QR:", err);
    }
  }

  return NextResponse.json({
    status: state.status,
    phone: state.phone,
    updatedAt: state.updated_at,
  });
}
