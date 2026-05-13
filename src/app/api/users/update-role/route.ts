import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Client, Users } from "node-appwrite";
import { getUserRole, type UserRole } from "@/lib/roles";
import { createAuditLog } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value;
    const userEmail = cookieStore.get("appwrite-user-email")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const users = new Users(client);
    const currentUser = await users.get(userId);
    const currentRole = getUserRole(currentUser.labels ?? []);

    // Solo admin puede cambiar roles
    if (currentRole !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden cambiar roles" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, newRole } = body;

    if (!targetUserId || !newRole) {
      return NextResponse.json(
        { error: "targetUserId y newRole requeridos" },
        { status: 400 }
      );
    }

    if (!["admin", "supervisor", "operator"].includes(newRole)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    const targetUser = await users.get(targetUserId);
    const oldRole = getUserRole(targetUser.labels ?? []);

    // Remover labels de rol anteriores y agregar el nuevo
    const newLabels = (targetUser.labels ?? []).filter(
      (l) => !["admin", "supervisor", "operator"].includes(l)
    );
    newLabels.push(newRole);

    await users.updateLabels(targetUserId, newLabels);

    // Registrar en auditoría
    await createAuditLog({
      action: "user.role_changed",
      userId,
      userEmail,
      resourceType: "user",
      resourceId: targetUserId,
      detail: JSON.stringify({
        targetEmail: targetUser.email,
        before: oldRole,
        after: newRole,
      }),
    });

    return NextResponse.json({
      success: true,
      message: `Rol de ${targetUser.email} actualizado de ${oldRole} a ${newRole}`,
    });
  } catch (err) {
    console.error("Error updating user role:", err);
    return NextResponse.json(
      { error: "Error al actualizar rol" },
      { status: 500 }
    );
  }
}
