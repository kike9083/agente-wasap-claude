import "./env-loader";
import { databases, DATABASE_ID, COLLECTIONS } from "../src/lib/appwrite";

async function addAttribute(
  fn: () => Promise<any>,
  label: string
) {
  try {
    await fn();
    console.log(`✅ ${label}`);
  } catch (err: any) {
    if (err?.code === 409) {
      console.log(`⚠️  ${label} (ya existe, omitido)`);
    } else {
      throw err;
    }
  }
}

async function main() {
  console.log("Migrando atributos para off-topic tracking...\n");

  // offtopicCount en conversations
  await addAttribute(
    () => databases.createIntegerAttribute(
      DATABASE_ID,
      COLLECTIONS.conversations,
      "offtopicCount",
      false,  // not required
      0,      // min
      1000,   // max
      0       // default
    ),
    "conversations.offtopicCount (integer, default 0)"
  );

  // offtopic_phrases en bot_settings
  await addAttribute(
    () => databases.createStringAttribute(
      DATABASE_ID,
      "bot_settings",
      "offtopic_phrases",
      5000,   // max length
      false,  // not required
      "[]"    // default
    ),
    "bot_settings.offtopic_phrases (string, default '[]')"
  );

  // offtopic_limit en bot_settings
  await addAttribute(
    () => databases.createIntegerAttribute(
      DATABASE_ID,
      "bot_settings",
      "offtopic_limit",
      false,
      1,
      100,
      3
    ),
    "bot_settings.offtopic_limit (integer, default 3)"
  );

  console.log("\nMigración completada.");
  console.log("Ejecuta 'npx ts-node scripts/update-system-prompt.ts' para actualizar las frases en Appwrite.");
}

main().catch(console.error);
