import { NextResponse } from "next/server";
import { Client, Users, Query } from "node-appwrite";

const adminClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

// Dev: admin SDK crea sesión sin necesitar la contraseña (cómodo para desarrollo local)
async function createSessionDev(email: string): Promise<{ userId: string; secret: string }> {
  const usersApi = new Users(adminClient);
  const list = await usersApi.list([Query.equal("email", [email])]);
  if (list.total === 0) throw new Error("Usuario no encontrado en Appwrite");
  const session = await usersApi.createSession(list.users[0].$id);
  return { userId: session.userId, secret: session.secret };
}

// Prod: endpoint estándar — Appwrite valida credenciales y aplica rate limit por IP del cliente
async function createSessionProd(
  email: string,
  password: string,
  clientIp: string
): Promise<{ userId: string; secret: string }> {
  const res = await fetch(`${process.env.APPWRITE_ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID!,
      "X-Forwarded-For": clientIp,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Credenciales incorrectas");
  // Appwrite 1.8 devuelve secret:"" — el ID real de la sesión está en $id
  return { userId: data.userId, secret: data.$id };
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }

    const cleanEmail = (email as string).trim().toLowerCase();
    const isProd = process.env.NODE_ENV === "production";
    let userId: string;
    let secret: string;

    try {
      if (isProd) {
        const clientIp =
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
          request.headers.get("x-real-ip") ??
          "127.0.0.1";
        ({ userId, secret } = await createSessionProd(cleanEmail, password, clientIp));
      } else {
        ({ userId, secret } = await createSessionDev(cleanEmail));
      }
    } catch (err: unknown) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    const cookieOpts = {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    };
    response.cookies.set("appwrite-session", secret, cookieOpts);
    response.cookies.set("appwrite-user-id", userId, cookieOpts);
    return response;
  } catch (err: unknown) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
