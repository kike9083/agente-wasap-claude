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

async function main() {
  console.log("\n=== Migrando atributos de escalación en bot_settings ===\n");

  try {
    // Agregar atributo escalation_agents
    await createAttr(
      () => db.createStringAttribute(DATABASE_ID, "bot_settings", "escalation_agents", 2000, false),
      "escalation_agents"
    );

    // Agregar atributo escalation_agent_index
    await createAttr(
      () => db.createIntegerAttribute(DATABASE_ID, "bot_settings", "escalation_agent_index", false),
      "escalation_agent_index"
    );

    console.log("\n✅ Migración completada.\n");
  } catch (e: any) {
    console.error("Error:", e?.message ?? e);
    process.exit(1);
  }
}

main();
