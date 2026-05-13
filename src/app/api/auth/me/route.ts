import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Client, Users } from "node-appwrite";
import { getUserRole } from "@/lib/roles";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get("appwrite-user-id")?.value;

    if (!userId) {
      return NextResponse.json({ error: "No userId cookie" }, { status: 401 });
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT_ID!)
      .setKey(process.env.APPWRITE_API_KEY!);

    const users = new Users(client);
    const user = await users.get(userId);

    const role = getUserRole(user.labels ?? []);

    return NextResponse.json({ user: { ...user, role } });
  } catch (err) {
    return NextResponse.json(
      { error: "Error fetching user" },
      { status: 500 }
    );
  }
}
