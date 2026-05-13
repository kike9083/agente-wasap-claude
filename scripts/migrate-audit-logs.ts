import "./env-loader";
import { Client, Databases, Permission, Role } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;

const perms = [
  Permission.read(Role.any()),
  Permission.create(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any()),
];

async function createAttr(fn: () => Promise<any>, label: string) {
  try {
    await fn();
    console.log(`  + atributo: ${label}`);
  } catch (e: any) {
    if (e?.code === 409) {
      console.log(`  → ya existe: ${label}`);
    } else {
      throw e;
    }
  }
}

async function createIndex(
  collectionId: string,
  key: string,
  type: "key" | "unique" | "fulltext",
  attrs: string[]
) {
  try {
    await db.createIndex(DATABASE_ID, collectionId, key, type as any, attrs);
    console.log(`  + índice: ${key}`);
  } catch (e: any) {
    if (e?.code === 409) {
      console.log(`  → índice ya existe: ${key}`);
    } else {
      throw e;
    }
  }
}

async function main() {
  console.log("\n=== Migrando colección audit_logs ===\n");

  try {
    // Crear colección
    try {
      await db.createCollection(DATABASE_ID, "audit_logs", "Audit Logs", perms);
      console.log("✓ Colección creada: Audit Logs");
    } catch (e: any) {
      if (e?.code === 409) {
        console.log("→ Colección ya existe: Audit Logs");
      } else {
        throw e;
      }
    }

    // Agregar atributos
    await createAttr(
      () => db.createStringAttribute(DATABASE_ID, "audit_logs", "action", 50, true),
      "action"
    );
    await createAttr(
      () => db.createStringAttribute(DATABASE_ID, "audit_logs", "userId", 50, true),
      "userId"
    );
    await createAttr(
      () => db.createStringAttribute(DATABASE_ID, "audit_logs", "userEmail", 100, false),
      "userEmail"
    );
    await createAttr(
      () => db.createStringAttribute(DATABASE_ID, "audit_logs", "resourceType", 50, true),
      "resourceType"
    );
    await createAttr(
      () => db.createStringAttribute(DATABASE_ID, "audit_logs", "resourceId", 100, false),
      "resourceId"
    );
    await createAttr(
      () => db.createStringAttribute(DATABASE_ID, "audit_logs", "detail", 2000, false),
      "detail"
    );
    await createAttr(
      () => db.createIntegerAttribute(DATABASE_ID, "audit_logs", "createdAt", true),
      "createdAt"
    );

    // Agregar índice
    await createIndex("audit_logs", "createdAt_desc", "key", ["createdAt"]);

    console.log("\n✅ Migración completada.\n");
  } catch (e: any) {
    console.error("Error:", e?.message ?? e);
    process.exit(1);
  }
}

main();
