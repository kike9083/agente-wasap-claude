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
  console.log("\n=== Setup Appwrite — agente-wasap ===\n");

  // ── conversations ──────────────────────────────────────────
  await createCollection("conversations", "Conversations");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "conversations", "phone", 100, true), "phone");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "conversations", "name", 100, false), "name");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "conversations", "mode", 10, false, "AI"), "mode");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "conversations", "lastMessageAt", false), "lastMessageAt");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "conversations", "lastMessagePreview", 300, false), "lastMessagePreview");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "conversations", "createdAt", true), "createdAt");
  await sleep(1500);
  await createIndex("conversations", "phone_unique", "unique", ["phone"]);
  await createIndex("conversations", "lastMessageAt_desc", "key", ["lastMessageAt"]);

  // ── messages ───────────────────────────────────────────────
  await createCollection("messages", "Messages");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "messages", "conversationId", 50, true), "conversationId");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "messages", "role", 20, true), "role");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "messages", "content", 10000, true), "content");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "messages", "createdAt", true), "createdAt");
  await sleep(1500);
  await createIndex("messages", "conversationId_idx", "key", ["conversationId"]);
  await createIndex("messages", "conv_created_idx", "key", ["conversationId", "createdAt"]);

  // ── connection_state ───────────────────────────────────────
  await createCollection("connection_state", "Connection State");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "connection_state", "status", 20, false, "disconnected"), "status");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "connection_state", "qrString", 10000, false), "qrString");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "connection_state", "phone", 50, false), "phone");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "connection_state", "updatedAt", true), "updatedAt");

  // ── outbox ─────────────────────────────────────────────────
  await createCollection("outbox", "Outbox");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "outbox", "conversationId", 50, true), "conversationId");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "outbox", "phone", 100, true), "phone");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "outbox", "content", 10000, true), "content");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "outbox", "status", 20, false, "pending"), "status");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "outbox", "createdAt", true), "createdAt");
  await sleep(1500);
  await createIndex("outbox", "status_idx", "key", ["status"]);
  await createIndex("outbox", "status_created_idx", "key", ["status", "createdAt"]);

  // ── restart_flag ───────────────────────────────────────────
  await createCollection("restart_flag", "Restart Flag");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "restart_flag", "requestedAt", false), "requestedAt");

  // ── bot_settings ───────────────────────────────────────────
  await createCollection("bot_settings", "Bot Settings");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "system_prompt", 5000, false), "system_prompt");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "welcome_message", 1000, false), "welcome_message");
  await createAttr(() => db.createIntegerAttribute(DATABASE_ID, "bot_settings", "human_timeout_hours", false), "human_timeout_hours");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "llm_model", 100, false, "openai/gpt-4o-mini"), "llm_model");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "host_phone", 50, false), "host_phone");
  await createAttr(() => db.createStringAttribute(DATABASE_ID, "bot_settings", "escalation_phrases", 2000, false), "escalation_phrases");

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
