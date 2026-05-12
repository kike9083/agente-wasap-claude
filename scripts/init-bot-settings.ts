import "./env-loader";
import { Client, Databases, ID } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;

async function main() {
  console.log("\n=== Inicializando Bot Settings ===\n");

  try {
    // Crear documento con configuración por defecto
    const settingsDoc = await db.createDocument(
      DATABASE_ID,
      "bot_settings",
      ID.unique(),
      {
        system_prompt: `Eres un asistente de servicio al cliente amable, profesional y empático.
Tu objetivo es ayudar a los clientes de manera clara y eficiente.
Si no puedes resolver algo, escala la conversación escribiendo: ESCALACIÓN_REQUERIDA`,
        welcome_message: "¡Hola! Bienvenido. ¿En qué puedo ayudarte hoy?",
        human_timeout_hours: 24,
        llm_model: "openai/gpt-4o-mini",
        host_phone: "",
        escalation_phrases: JSON.stringify([
          "ESCALACIÓN_REQUERIDA",
          "necesito hablar con un asesor",
          "hablar con un humano",
        ]),
      }
    );

    console.log(`✓ Documento de configuración creado con ID: ${settingsDoc.$id}`);
    console.log("\n✅ Inicialización completada.\n");
    console.log("Próximos pasos:");
    console.log("1. Ingresa al dashboard en http://localhost:3000");
    console.log("2. Ve a /settings y actualiza:");
    console.log("   - HOST_PHONE: número del asesor de ventas");
    console.log("   - SYSTEM_PROMPT: instrucciones para tu negocio");
    console.log("   - ESCALATION_PHRASES: palabras clave para detectar escalaciones");
  } catch (e: any) {
    console.error("Error:", e?.message ?? e);
    process.exit(1);
  }
}

main();
