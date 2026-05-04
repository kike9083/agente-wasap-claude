/**
 * Añade el atributo 'tags' (string, array-like JSON) a la colección conversations.
 * Correr una vez: npx tsx scripts/add-tags-attribute.ts
 */
import "./env-loader";
import { Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;
const COLLECTION_ID = "conversations";

async function main() {
  // Verificar si ya existe
  try {
    await db.getAttribute(DATABASE_ID, COLLECTION_ID, "tags");
    console.log("✓ El atributo 'tags' ya existe. Nada que hacer.");
    return;
  } catch {
    // no existe, lo creamos
  }

  await db.createStringAttribute(DATABASE_ID, COLLECTION_ID, "tags", 1000, false, "[]");
  console.log("✓ Atributo 'tags' creado en la colección conversations.");
  console.log("  Espera ~5s a que Appwrite lo indexe antes de usarlo.");
}

main().catch((e) => {
  console.error("Error:", e?.message ?? e);
  process.exit(1);
});
