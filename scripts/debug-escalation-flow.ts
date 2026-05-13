import "./env-loader";
import { getBotSettings, getNextEscalationAgent, notifyHostViaOutbox } from "@/lib/db";

async function main() {
  console.log("\n=== Debug: Flujo Completo de Escalación ===\n");

  try {
    console.log("1. Obteniendo settings...");
    const settings = await getBotSettings();
    console.log("   ✓ Settings obtenido");
    console.log("   escalation_agents:", settings?.escalation_agents);
    console.log("   escalation_agent_index:", settings?.escalation_agent_index);

    console.log("\n2. Llamando a getNextEscalationAgent()...");
    const agentPhone = await getNextEscalationAgent();
    console.log("   ✓ Resultado:", agentPhone);

    const finalPhone = agentPhone || process.env.HOST_PHONE;
    console.log(`\n3. Teléfono final para escalación: ${finalPhone}`);
    console.log("   (Si es agentPhone → round-robin funciona)");
    console.log("   (Si es HOST_PHONE → getNextEscalationAgent retorna null)");

    console.log("\n4. Simulando notifyHostViaOutbox...");
    await notifyHostViaOutbox("telegram", "TestUser", "Test message").catch((err) => {
      console.log("   ✗ Error:", err instanceof Error ? err.message : err);
    });
    console.log("   ✓ notifyHostViaOutbox completado");

  } catch (err) {
    console.error("❌ Error:", err);
  }

  console.log("\n");
}

main();
