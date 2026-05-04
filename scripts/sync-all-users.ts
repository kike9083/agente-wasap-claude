import { Client, Users } from 'node-appwrite';
import 'dotenv/config';

async function syncAllUsers() {
  const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!projectId || !apiKey) {
    console.error("Faltan variables de entorno (PROJECT_ID o API_KEY)");
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  const usersApi = new Users(client);

  // Leer usuarios de la variable de entorno DASHBOARD_USERS
  const rawUsers = (process.env.DASHBOARD_USERS ?? "").replace(/^["']|["']$/g, "").trim();
  if (!rawUsers) {
    console.log("No hay usuarios en DASHBOARD_USERS para sincronizar.");
    return;
  }

  const usersToSync = rawUsers.split(",").map(entry => {
    const colon = entry.indexOf(":");
    if (colon < 0) return null;
    return {
      email: entry.slice(0, colon).trim().toLowerCase(),
      password: entry.slice(colon + 1).trim()
    };
  }).filter(u => u !== null && !u.password.startsWith("scrypt:")); // Solo sincronizamos si la pass es plana

  for (const u of usersToSync as any[]) {
    try {
      const list = await usersApi.list();
      const existing = list.users.find(user => user.email === u.email);

      if (existing) {
        await usersApi.updatePassword(existing.$id, u.password);
        console.log(`✅ Password actualizada para ${u.email}`);
      } else {
        await usersApi.create('unique()', u.email, undefined, u.password);
        console.log(`✅ Usuario creado: ${u.email}`);
      }
    } catch (error: any) {
      console.error(`❌ Error con ${u.email}:`, error.message);
    }
  }
}

syncAllUsers();
