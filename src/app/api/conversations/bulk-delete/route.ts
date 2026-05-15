import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteConversation, createAuditLog, getConversationById } from "@/lib/db";
import { Client, Account } from "node-appwrite";
import { getUserRole, ROLE_PERMISSIONS } from "@/lib/roles";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get("appwrite-session")?.value;
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT_ID!)
    .setSession(session);

  let userId = "unknown";
  let userEmail: string | undefined;

  try {
    const account = new Account(client);
    const user = await account.get();
    const role = getUserRole(user.labels ?? []);
    if (!ROLE_PERMISSIONS[role].canDeleteConversation) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
    userId = user.$id;
    userEmail = user.email;
  } catch {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json();
  const ids: string[] = body.ids ?? [];

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
  }

  const deleted: string[] = [];
  const failed: string[] = [];

  for (const id of ids) {
    try {
      const conversation = await getConversationById(id);
      await deleteConversation(id);
      await createAuditLog({
        action: "conversation.delete",
        userId,
        userEmail,
        resourceType: "conversation",
        resourceId: id,
        detail: conversation
          ? JSON.stringify({ name: conversation.name, platform: conversation.platform, externalId: conversation.externalId })
          : undefined,
      });
      deleted.push(id);
    } catch {
      failed.push(id);
    }
  }

  return NextResponse.json({ deleted, failed });
}
