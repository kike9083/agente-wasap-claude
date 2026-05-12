import "./env-loader";
import { Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;

async function main() {
  console.log("\n=== Migrando colección outbox — añadiendo atributo platform ===\n");

  try {
    // Agregar atributo platform a outbox
    console.log("Intentando agregar atributo 'platform' a colección 'outbox'...");
    try {
      await db.createStringAttribute(
        DATABASE_ID,
        "outbox",
        "platform",
        20,
        false,
        "whatsapp"
      );
      console.log("  ✓ Atributo 'platform' creado con default 'whatsapp'");
    } catch (e: any) {
      if (e?.code === 409) {
        console.log("  → Atributo 'platform' ya existe");
      } else {
        throw e;
      }
    }

    console.log("\n✅ Migración completada.\n");
  } catch (e: any) {
    console.error("Error en migración:", e?.message ?? e);
    process.exit(1);
  }
}

main();
