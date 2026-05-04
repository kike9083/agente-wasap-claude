
import { Client, Databases, Users } from "node-appwrite";
import "dotenv/config";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

async function diagnose() {
  console.log("=== DIAGNÓSTICO DE RED Y APPWRITE ===");
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Project ID: ${PROJECT_ID ? "Configurado" : "FALTANTE"}`);
  console.log(`API Key: ${API_KEY ? "Configurada" : "FALTANTE"}`);
  
  if (!PROJECT_ID || !API_KEY) {
    console.error("ERROR: Faltan variables de entorno críticas.");
    return;
  }

  const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

  const databases = new Databases(client);

  console.log("\n1. Probando resolución DNS y Latencia (HTTP GET)...");
  try {
    const start = Date.now();
    const res = await fetch(ENDPOINT.replace("/v1", "/health"));
    const duration = Date.now() - start;
    console.log(`✅ Conexión HTTP básica exitosa. Status: ${res.status}. Latencia: ${duration}ms`);
  } catch (err: any) {
    console.error(`❌ Error en conexión HTTP básica: ${err.message}`);
  }

  console.log("\n2. Probando API de Appwrite (List Databases)...");
  try {
    const start = Date.now();
    const dbs = await databases.list();
    const duration = Date.now() - start;
    console.log(`✅ Appwrite API OK. Encontradas ${dbs.total} bases de datos. Latencia: ${duration}ms`);
  } catch (err: any) {
    console.error(`❌ Error en Appwrite API: ${err.message}`);
    if (err.code === 401) console.error("   (Posible API Key inválida)");
    if (err.code === 403) console.error("   (Faltan permisos en la API Key)");
  }

  console.log("\n3. Verificando usuarios en DASHBOARD_USERS...");
  const usersStr = process.env.DASHBOARD_USERS || "";
  console.log(`Usuarios configurados: ${usersStr.split(",").length}`);
  usersStr.split(",").forEach(u => {
    const [email] = u.split(":");
    console.log(` - ${email}`);
  });

  console.log("\n4. Verificando existencia de usuario en Appwrite...");
  const users = new Users(client);
  const testEmail = "kike@jaigerhouse.com";
  try {
    const result = await users.list([`equal("email", "${testEmail}")`]);
    if (result.total > 0) {
      console.log(`✅ Usuario ${testEmail} existe en Appwrite.`);
    } else {
      console.warn(`⚠️ Usuario ${testEmail} NO existe en Appwrite. Use scripts/sync-all-users.ts`);
    }
  } catch (err: any) {
    console.error(`❌ Error verificando usuario: ${err.message}`);
  }

  console.log("\n=== FIN DEL DIAGNÓSTICO ===");
}

diagnose();
