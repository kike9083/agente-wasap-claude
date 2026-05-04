import { NextResponse } from "next/server";
import { Client, Users, Query } from "node-appwrite";
import crypto from "node:crypto";

const adminClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

// Soporta dos formatos en DASHBOARD_USERS:
//   Dev  → email:contraseña_plana
//   Prod → email:scrypt:salt:hash   (generado con scripts/hash-password.ts)
function verifyPassword(plain: string, stored: string): boolean {
  if (stored.startsWith("scrypt:")) {
    const parts = stored.split(":");
    const salt = parts[1];
    const expected = Buffer.from(parts[2], "hex");
    try {
      const derived = crypto.scryptSync(plain, salt, 64);
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }
  return plain === stored;
}

function verifyCredentials(email: string, password: string): boolean {
  const entries = (process.env.DASHBOARD_USERS ?? "").split(",");
  return entries.some((entry) => {
    const colon = entry.indexOf(":");
    if (colon < 0) return false;
    const e = entry.slice(0, colon).trim();
    const stored = entry.slice(colon + 1).trim();
    return e === email && verifyPassword(password, stored);
  });
}

// Dev: admin SDK — sin rate limit, cómodo para desarrollo
async function createSessionDev(email: string): Promise<{ userId: string; secret: string }> {
  const usersApi = new Users(adminClient);
  const list = await usersApi.list([Query.equal("email", [email])]);
  if (list.total === 0) throw new Error("Usuario no encontrado en Appwrite");
  const session = await usersApi.createSession(list.users[0].$id);
  return { userId: session.userId, secret: session.secret };
}

// Prod: endpoint estándar de Appwrite con IP real del cliente
// → el rate limit de Appwrite aplica por IP del usuario, no del servidor
async function createSessionProd(
  email: string,
  password: string,
  clientIp: string
): Promise<{ userId: string; secret: string }> {
  const endpoint = process.env.APPWRITE_ENDPOINT!;
  const projectId = process.env.APPWRITE_PROJECT_ID!;

  const res = await fetch(`${endpoint}/account/sessions/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": projectId,
      "X-Forwarded-For": clientIp,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Credenciales incorrectas");
  return { userId: data.userId, secret: data.secret };
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email y contraseña son requeridos" },
        { status: 400 }
      );
    }

    // Verificación local primero — rechaza credenciales inválidas sin tocar Appwrite
    if (!verifyCredentials(email, password)) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const isProd = process.env.NODE_ENV === "production";
    let userId: string;
    let secret: string;

    if (isProd) {
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        request.headers.get("x-real-ip") ??
        "127.0.0.1";
      ({ userId, secret } = await createSessionProd(email, password, clientIp));
    } else {
      ({ userId, secret } = await createSessionDev(email));
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
    console.error("[auth/login] Error:", err);
    const message = err instanceof Error ? err.message : "Error al iniciar sesión";
    const status = message.includes("Rate limit") ? 429 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}
