import "./env-loader";
import { getNextEscalationAgent, getBotSettings } from "@/lib/db";

async function main() {
  console.log("\n=== Prueba de Round-Robin de Escalación ===\n");

  // Verificar configuración inicial
  console.log("📋 Configuración actual en Appwrite:");
  const settings = await getBotSettings();
  let agents: string[] = [];
  try {
    agents = JSON.parse(settings?.escalation_agents || "[]");
  } catch {}
  console.log(`   Agentes: ${agents.join(", ") || "NINGUNO"}`);
  console.log(`   Índice actual: ${settings?.escalation_agent_index ?? 0}\n`);

  if (agents.length === 0) {
    console.log("❌ No hay agentes configurados. Agrega 2-3 números en Settings → Global → Agentes de Escalación\n");
    return;
  }

  console.log("🔄 Simulando 6 escalaciones consecutivas:\n");

  for (let i = 1; i <= 6; i++) {
    console.log(`Escalación #${i}:`);
    const agentPhone = await getNextEscalationAgent();
    console.log(`  → Asignado a: ${agentPhone}`);

    // Pequeña pausa para ver los logs
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("\n✅ Test completado. El índice debería haber rotado correctamente.\n");
}

main().catch(console.error);
