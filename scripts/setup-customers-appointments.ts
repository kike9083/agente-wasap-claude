import "./env-loader";
import { Client, Databases, IndexType, Permission, Role } from "node-appwrite";

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createCollection(id: string, name: string) {
  try {
    await db.createCollection(DATABASE_ID, id, name, perms);
    console.log(`  + colección: ${name}`);
  } catch (e: any) {
    if (e?.code === 409) console.log(`  → ya existe: ${name}`);
    else throw e;
  }
}

async function createAttr(fn: () => Promise<any>, label: string) {
  try {
    await fn();
    console.log(`    + ${label}`);
  } catch (e: any) {
    if (e?.code === 409) console.log(`    → ya existe: ${label}`);
    else throw e;
  }
}

async function createIndex(collectionId: string, key: string, attribute: string) {
  try {
    await db.createIndex(DATABASE_ID, collectionId, key, IndexType.Key, [attribute]);
    console.log(`    + índice: ${key}`);
  } catch (e: any) {
    if (e?.code === 409) console.log(`    → ya existe índice: ${key}`);
    else throw e;
  }
}

async function main() {
  console.log("\n=== Setup: customers + appointments + conv_state ===\n");

  // ── customers ────────────────────────────────────────────────────────────
  console.log("1. Colección: customers");
  await createCollection("customers", "customers");
  await sleep(800);
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "customers", "conversationId", 36, true), "conversationId");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "customers", "platform", 20, true), "platform");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "customers", "nombre", 100, true), "nombre");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "customers", "apellido", 100, true), "apellido");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "customers", "telefonoCelular", 30, true), "telefonoCelular");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "customers", "createdAt", true), "createdAt");
  await sleep(1500);
  await createIndex("customers", "conversationId_idx", "conversationId");

  // ── appointments ─────────────────────────────────────────────────────────
  console.log("\n2. Colección: appointments");
  await createCollection("appointments", "appointments");
  await sleep(800);
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "appointments", "customerId", 36, false), "customerId");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "appointments", "conversationId", 36, true), "conversationId");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "appointments", "tipoServicio", 100, true), "tipoServicio");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "appointments", "fecha", 30, true), "fecha");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "appointments", "hora", 10, true), "hora");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "appointments", "notas", 1000, false), "notas");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "appointments", "status", 20, false, "pending"), "status");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "appointments", "googleEventId", 200, false), "googleEventId");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "appointments", "createdAt", true), "createdAt");
  await sleep(1500);
  await createIndex("appointments", "conversationId_idx", "conversationId");
  await createIndex("appointments", "fecha_hora_idx", "fecha");

  // ── conv_state en conversations ───────────────────────────────────────────
  console.log("\n3. Atributo conv_state en conversations");
  await createAttr(
    () => db.createStringAttribute(DATABASE_ID, "conversations", "conv_state", 2000, false),
    "conv_state"
  );

  // ── scheduling_phrases en bot_settings ───────────────────────────────────
  console.log("\n4. Atributo scheduling_phrases en bot_settings");
  await createAttr(
    () => db.createStringAttribute(DATABASE_ID, "bot_settings", "scheduling_phrases", 1000, false),
    "scheduling_phrases"
  );

  console.log("\n✅ Migración completada.\n");
}

main().catch((e) => {
  console.error("Error:", e?.message ?? e);
  process.exit(1);
});
