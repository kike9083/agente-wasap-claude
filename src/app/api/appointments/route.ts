import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Client, Account } from "node-appwrite";
import {
  listAppointments,
  updateAppointmentStatus,
  getCustomerByConversation,
  type AppointmentStatus,
} from "@/lib/db";
import { getUserRole, ROLE_PERMISSIONS } from "@/lib/roles";

async function getAuthUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get("appwrite-session")?.value;
  if (!session) return null;

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setSession(session);

  try {
    const account = new Account(client);
    const user = await account.get();
    const role = getUserRole(user.labels ?? []);
    return { user, role };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!ROLE_PERMISSIONS[auth.role].canViewAuditLogs) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as AppointmentStatus | null;
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const appointments = await listAppointments(status ?? undefined, limit);

  // Enrich with customer names
  const enriched = await Promise.all(
    appointments.map(async (appt) => {
      const customer = await getCustomerByConversation(appt.conversationId).catch(() => null);
      return { ...appt, customer: customer ?? null };
    })
  );

  return NextResponse.json({ appointments: enriched });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!ROLE_PERMISSIONS[auth.role].canViewAuditLogs) {
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
