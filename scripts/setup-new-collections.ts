import "./env-loader";
import { Client, Databases, ID, Permission, Role } from "node-appwrite";

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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createCollection(id: string, name: string) {
  try {
    await db.createCollection(DATABASE_ID, id, name, perms);
    console.log(`✓ Colección creada: ${name}`);
  } catch (e: any) {
    if (e?.code === 409) {
      console.log(`→ Ya existe: ${name}`);
    } else {
      throw e;
    }
  }
}

async function createAttr(
  fn: () => Promise<any>,
  label: string
) {
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
  console.log("\n=== Setup Nuevas Colecciones — agente-wasap ===\n");

  // ── bot_settings ───────────────────────────────────────────
  await createCollection("bot_settings", "Bot Settings");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "system_prompt", 5000, false), "system_prompt");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "welcome_message", 1000, false), "welcome_message");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "bot_settings", "human_timeout_hours", false), "human_timeout_hours");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "llm_model", 100, false, "openai/gpt-4o-mini"), "llm_model");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "host_phone", 50, false), "host_phone");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "escalation_phrases", 2000, false), "escalation_phrases");
  await sleep(1500);

  // ── products ───────────────────────────────────────────────
  await createCollection("products", "Products");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "products", "sku", 50, true), "sku");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "products", "name", 500, true), "name");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "products", "price", 20, false), "price");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "products", "url", 500, false), "url");
  await sleep(1500);
  await createIndex("products", "sku_unique", "unique", ["sku"]);

  // ── templates ──────────────────────────────────────────────
  await createCollection("templates", "Quick Reply Templates");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "templates", "label", 100, true), "label");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "templates", "content", 1000, true), "content");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "templates", "createdAt", true), "createdAt");

  console.log("\n✅ Setup completado.\n");
}

main().catch((e) => {
  console.error("Error en setup:", e?.message ?? e);
  process.exit(1);
});
