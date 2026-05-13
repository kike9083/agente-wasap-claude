import "./env-loader";
import { getBotSettings } from "@/lib/db";

async function main() {
  console.log("\n=== Verificando Agentes de Escalación en Appwrite ===\n");

  const settings = await getBotSettings();

  if (!settings) {
    console.log("❌ No se encontraron settings en Appwrite");
    return;
  }

  console.log("Settings encontrados:");
  console.log("  escalation_agents (raw):", JSON.stringify(settings.escalation_agents));
  console.log("  escalation_agent_index:", settings.escalation_agent_index);

  let agents: string[] = [];
  try {
    agents = JSON.parse(settings.escalation_agents || "[]");
    console.log("  Agentes parseados:", agents);
  } catch (e) {
    console.error("  ❌ Error parseando escalation_agents:", e);
  }

  if (agents.length === 0) {
    console.log("\n⚠️  No hay agentes configurados. Se usará host_phone como fallback.");
    console.log("  host_phone:", settings.host_phone);
  } else {
    console.log(`\n✅ ${agents.length} agente(s) configurado(s):`);
    agents.forEach((agent, i) => {
      console.log(`  [${i}] ${agent}`);
    });
  }

  console.log("\n");
}

main().catch(console.error);
