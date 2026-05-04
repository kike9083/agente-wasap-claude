// Llamadas a Appwrite hechas con fetch nativo para evitar dependencia del
// browser SDK (appwrite@25 requiere servidor >=1.9.2, el nuestro es 1.8.x).

function getEnv() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  if (!endpoint || !projectId) {
    throw new Error("APPWRITE_ENDPOINT y APPWRITE_PROJECT_ID deben estar en .env.local");
  }
  return { endpoint, projectId };
}

/**
 * Crea una sesión email/password en Appwrite 1.8.x via REST.
 * clientIp se reenvía en X-Forwarded-For para que el rate-limit se aplique
 * por IP del cliente, no por la IP del servidor Next.js.
 */
export async function createEmailSession(
  email: string,
  password: string,
  clientIp?: string
): Promise<{ userId: string; secret: string }> {
  const { endpoint, projectId } = getEnv();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Appwrite-Project": projectId,
  };
  if (clientIp) headers["X-Forwarded-For"] = clientIp;

  const res = await fetch(`${endpoint}/account/sessions/email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? "Credenciales incorrectas");
  }

  return { userId: data.userId, secret: data.secret };
}
