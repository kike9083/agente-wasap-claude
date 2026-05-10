import "./env-loader";
import { databases, DATABASE_ID } from "../src/lib/appwrite";

async function addAttr(fn: () => Promise<any>, label: string) {
  try {
    await fn();
    console.log(`✅ ${label}`);
  } catch (err: any) {
    if (err?.code === 409) console.log(`⚠️  ${label} (ya existe)`);
    else throw err;
  }
}

async function main() {
  console.log("Creando colección channel_settings...\n");

  // Crear colección
  try {
    await databases.createCollection(DATABASE_ID, "channel_settings", "channel_settings");
    console.log("✅ Colección channel_settings creada");
  } catch (err: any) {
    if (err?.code === 409) console.log("⚠️  Colección channel_settings ya existe");
    else throw err;
  }

  // Atributos
  await addAttr(
    () => databases.createStringAttribute(DATABASE_ID, "channel_settings", "platform", 20, true),
    "platform (string, required)"
  );
  await addAttr(
    () => databases.createStringAttribute(DATABASE_ID, "channel_settings", "system_prompt", 50000, false, ""),
    "system_prompt (string)"
  );
  await addAttr(
    () => databases.createStringAttribute(DATABASE_ID, "channel_settings", "welcome_message", 2000, false, ""),
    "welcome_message (string)"
  );
  await addAttr(
    () => databases.createStringAttribute(DATABASE_ID, "channel_settings", "llm_model", 200, false, ""),
    "llm_model (string)"
  );
  await addAttr(
    () => databases.createStringAttribute(DATABASE_ID, "channel_settings", "host_phone", 50, false, ""),
    "host_phone (string)"
  );
  await addAttr(
    () => databases.createStringAttribute(DATABASE_ID, "channel_settings", "escalation_phrases", 5000, false, "[]"),
    "escalation_phrases (string)"
  );
  await addAttr(
    () => databases.createStringAttribute(DATABASE_ID, "channel_settings", "offtopic_phrases", 5000, false, "[]"),
    "offtopic_phrases (string)"
  );
  await addAttr(
    () => databases.createIntegerAttribute(DATABASE_ID, "channel_settings", "offtopic_limit", false, 1, 100, 3),
    "offtopic_limit (integer, default 3)"
  );

  console.log("\n✅ Migración completada.");
  console.log("Los documentos se crean bajo demanda cuando se guarda configuración por canal.");
}

main().catch(console.error);
