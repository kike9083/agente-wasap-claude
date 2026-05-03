import { NextRequest, NextResponse } from "next/server";
import { getConnectionState } from "@/lib/db";
import QRCode from "qrcode";

export async function GET(_req: NextRequest) {
  const state = await getConnectionState();

  const shouldShowQr =
    !!state.qr_string &&
    (state.status === "qr" || state.status === "connecting");

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
