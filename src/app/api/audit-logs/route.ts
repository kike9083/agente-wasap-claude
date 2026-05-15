import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Client, Databases, Query, Users } from "node-appwrite";
import { getUserRole } from "@/lib/roles";
import { DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const users = new Users(client);
    const currentUser = await users.get(userId);
    const currentRole = getUserRole(currentUser.labels ?? []);

    if (currentRole !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden ver auditoría" },
        { status: 403 }
      );
    }

    const databases = new Databases(client);
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.audit_logs,
      [Query.orderDesc("$createdAt"), Query.limit(100)]
    );

    return NextResponse.json({ logs: response.documents });
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    return NextResponse.json(
      { error: "Error al obtener auditoría" },
      { status: 500 }
    );
  }
}
