/**
 * Migración Fase 1 — Omnicanal
 * Agrega platform + externalId a conversations y outbox.
 * Corre UNA VEZ contra la BD de producción.
 */
import "./env-loader";
import { Client, Databases, Query, IndexType } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DB = process.env.APPWRITE_DATABASE_ID!;

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("[migrate] Iniciando migración omnicanal...");

  // 1. Agregar atributos a conversations
  console.log("[migrate] Agregando atributo 'platform' a conversations...");
  try {
    await db.createStringAttribute(DB, "conversations", "platform", 20, false, "whatsapp");
    console.log("[migrate] ✅ platform creado");
  } catch (e: any) {
    if (e.code === 409) console.log("[migrate] platform ya existe — OK");
    else throw e;
  }

  console.log("[migrate] Agregando atributo 'externalId' a conversations...");
  try {
    await db.createStringAttribute(DB, "conversations", "externalId", 100, false);
    console.log("[migrate] ✅ externalId creado");
  } catch (e: any) {
    if (e.code === 409) console.log("[migrate] externalId ya existe — OK");
    else throw e;
  }

  // 2. Agregar platform a outbox
  console.log("[migrate] Agregando atributo 'platform' a outbox...");
  try {
    await db.createStringAttribute(DB, "outbox", "platform", 20, false, "whatsapp");
    console.log("[migrate] ✅ outbox.platform creado");
  } catch (e: any) {
    if (e.code === 409) console.log("[migrate] outbox.platform ya existe — OK");
    else throw e;
  }

  // Esperar que Appwrite propague los atributos
  console.log("[migrate] Esperando propagación de atributos (5s)...");
  await wait(5000);

  // 3. Migrar documentos existentes: externalId = phone, platform = "whatsapp"
  console.log("[migrate] Migrando documentos existentes (externalId ← phone)...");
  let migrated = 0;
  let cursor: string | undefined;

  while (true) {
    const queries: any[] = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const result = await db.listDocuments(DB, "conversations", queries);
    if (result.documents.length === 0) break;

    for (const doc of result.documents) {
      // Solo migrar si aún no tiene externalId
      if (!doc.externalId) {
        await db.updateDocument(DB, "conversations", doc.$id, {
          platform: "whatsapp",
          externalId: doc.phone,
        });
        migrated++;
      }
    }

    if (result.documents.length < 100) break;
    cursor = result.documents[result.documents.length - 1].$id;
  }
  console.log(`[migrate] ✅ ${migrated} conversaciones migradas`);

  // 4. Crear índice compuesto único (platform, externalId)
  console.log("[migrate] Creando índice compuesto (platform, externalId)...");
  await wait(2000);
  try {
    await db.createIndex(DB, "conversations", "platform_externalId_unique", IndexType.Key, ["platform", "externalId"]);
    console.log("[migrate] ✅ Índice compuesto creado");
  } catch (e: any) {
    if (e.code === 409) console.log("[migrate] Índice ya existe — OK");
    else console.warn("[migrate] ⚠️ Error creando índice:", e.message);
  }

  console.log("[migrate] ✅ Migración completada");
}

run().catch((e) => {
  console.error("[migrate] ❌ Error:", e);
  process.exit(1);
});
