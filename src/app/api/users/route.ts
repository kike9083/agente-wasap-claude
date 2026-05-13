import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Client, Users } from "node-appwrite";
import { getUserRole } from "@/lib/roles";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value;

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

    // Solo admin puede ver la lista de usuarios
    if (currentRole !== "admin") {
      return NextResponse.json(
        { error: "Solo administradores pueden ver usuarios" },
        { status: 403 }
      );
    }

    const userList = await users.list();

    const formattedUsers = userList.users.map((user) => ({
      id: user.$id,
      email: user.email,
      name: user.name || user.email,
      role: getUserRole(user.labels ?? []),
      labels: user.labels ?? [],
      createdAt: user.$createdAt,
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (err) {
    console.error("Error fetching users:", err);
    return NextResponse.json(
      { error: "Error al obtener usuarios" },
      { status: 500 }
    );
  }
}
