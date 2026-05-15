import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Client, Users } from "node-appwrite";
import {
  listAppointments,
  updateAppointmentStatus,
  getCustomerByConversation,
  type AppointmentStatus,
} from "@/lib/db";
import { getUserRole, ROLE_PERMISSIONS } from "@/lib/roles";

async function getAuthRole() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("appwrite-user-id")?.value;
  if (!userId) return null;

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  try {
    const users = new Users(client);
    const user = await users.get(userId);
    return getUserRole(user.labels ?? []);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const role = await getAuthRole();
  if (!role) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!ROLE_PERMISSIONS[role].canViewAppointments) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as AppointmentStatus | null;
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const appointments = await listAppointments(status ?? undefined, limit);

  const enriched = await Promise.all(
    appointments.map(async (appt) => {
      const customer = await getCustomerByConversation(appt.conversationId).catch(() => null);
      return { ...appt, customer: customer ?? null };
    })
  );

  return NextResponse.json({ appointments: enriched });
}

export async function PATCH(req: NextRequest) {
  const role = await getAuthRole();
  if (!role) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!ROLE_PERMISSIONS[role].canViewAppointments) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = await req.json();
  const { id, status } = body as { id: string; status: AppointmentStatus };

  const validStatuses: AppointmentStatus[] = ["pending", "confirmed", "cancelled", "completed"];
  if (!id || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  await updateAppointmentStatus(id, status);
  return NextResponse.json({ ok: true });
}
