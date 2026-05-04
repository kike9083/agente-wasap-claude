import { Client, Databases } from "node-appwrite";
import "./env-loader"; // Asegura que las variables de entorno se carguen primero

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;

async function main() {
  console.log("Añadiendo nuevos atributos a bot_settings...");

  try {
    await databases.createStringAttribute(
      DATABASE_ID,
      "bot_settings",
      "host_phone",
      20,
      false,
      "50761142198"
    );
    console.log("✅ host_phone atributo creado");
  } catch (err: any) {
    if (err.code === 409) {
      console.log("ℹ️ host_phone ya existe");
    } else {
      console.error("❌ Error con host_phone:", err);
    }
  }

  try {
    await databases.createStringAttribute(
      DATABASE_ID,
      "bot_settings",
      "escalation_phrases",
      2000,
      false,
      JSON.stringify([
        "conectarte con uno de nuestros hosts",
        "derivarte con un asesor humano",
        "déjame derivarte",
        "déjame conectarte",
        "conectarte con nuestra asesora de ventas",
        "derivarte con nuestra asesora de ventas"
      ])
    );
    console.log("✅ escalation_phrases atributo creado");
  } catch (err: any) {
    if (err.code === 409) {
      console.log("ℹ️ escalation_phrases ya existe");
    } else {
      console.error("❌ Error con escalation_phrases:", err);
    }
  }

  console.log("¡Listo! Espera unos segundos a que Appwrite termine de indexar.");
}

main().catch(console.error);
