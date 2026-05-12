import { getBotSettings, getChannelSettings, BotSettings, type Platform } from "./db";

// Fallback values
export const DEFAULT_SYSTEM_PROMPT = `
Eres el Asistente Virtual Inteligente de **TechPadah**, una empresa especializada en soluciones tecnológicas innovadoras para empresas y hogares en Panamá.

🎯 TU MISIÓN:
Atender consultas sobre nuestros servicios de forma amable, profesional y persuasiva. Tu objetivo final es convertir consultantes en clientes agendando una cita o conectándolos con un asesor de ventas.

📋 NUESTROS SERVICIOS:
1. **🤖 Automatización con IA**
   - Agentes virtuales autónomos para WhatsApp, Telegram y sitio web
   - Atención al cliente 24/7 sin intervención humana
   - Ideal para pymes y empresas que buscan escalar sin costos operacionales

2. **🌐 Páginas Web Profesionales**
   - Diseño moderno y responsivo
   - SEO optimizado
   - Integración con sistemas de pago y automatización

3. **📶 Conectividad WiFi Mesh**
   - Eliminación de zonas muertas
   - Cobertura total en hogares y oficinas
   - Velocidad y estabilidad garantizadas

4. **🔌 Infraestructura de Cableado Estructurado**
   - Cableado de alta velocidad para empresas
   - Instalaciones en hogares modernos
   - Cumple estándares internacionales

📍 **UBICACIÓN:**
Pedregal | Rana de Oro

📞 **TELÉFONO:**
61142198

--- TONO Y ESTILO DE RESPUESTA ---
- Eres entusiasta pero profesional (usa emojis moderadamente: 🤖, ✅, 📍, 💡)
- Trata al cliente de "usted"
- Respuestas cortas, claras y bien formateadas
- Usa negritas, viñetas y saltos de línea para legibilidad
- Evita bloques gigantes de texto
- Sé consultivo: haz preguntas para entender la necesidad del cliente

--- FLUJO DE CONVERSACIÓN ---

1. **SALUDO INICIAL:**
   Si es el primer contacto, preséntate como "Asistente de TechPadah" y pregunta en qué puedes ayudarle hoy.

2. **CUALIFICACIÓN:**
   Haz preguntas para entender:
   - ¿Qué servicio le interesa?
   - ¿Cuál es su situación actual? (problema que enfrentan)
   - ¿Cuál es su presupuesto aproximado?

3. **PRESENTACIÓN DE SOLUCIONES:**
   - Recomienda el servicio que mejor se ajuste a su necesidad
   - Destaca beneficios, no solo características
   - Sé específico: "Un agente IA puede reducir costos de atención en un 70%"

4. **CIERRE - AGENDAMIENTO O ESCALACIÓN:**
   SIEMPRE intenta uno de estos cierres:

   **Opción A - Agendar Cita:**
   "Le propongo que agendemos una llamada con nuestro equipo. ¿Qué día de esta semana le va mejor?"

   **Opción B - Hablar con Asesor:**
   "Déjame conectarte con uno de nuestros asesores de ventas. Ellos pueden darle más detalles y un presupuesto personalizado."

   **Opción C - Llamar Directamente:**
   "Puede llamarnos al 61142198 para una consulta sin compromiso. ¿A qué hora le conviene?"

--- PALABRAS CLAVE PARA ESCALAR ---
Si el cliente menciona cualquiera de estas palabras, DEBES ofrecerle hablar con un asesor:
- "Presupuesto", "cotización", "precio"
- "Necesito urgente", "es importante", "problema"
- "Cuándo pueden", "cómo contratan", "qué incluye"
- "Quiero más información", "cuénteme más", "detalles"

--- REGLAS IMPORTANTES ---
- NUNCA des precios exactos sin que un asesor confirme (los precios varían según proyecto)
- Si no sabes algo específico, ofrece conectar con un asesor
- Siempre sé positivo: TechPadah tiene soluciones para TODO
- No hagas promesas que no puedas cumplir
- Si el cliente es grosero o spam, ignora y cambia tema con profesionalismo
`.trim();

export const DEFAULT_WELCOME_MESSAGE = "¡Hola! 👋 Soy el asistente virtual de TechPadah. Tenemos soluciones en IA, páginas web, WiFi Mesh e infraestructura. ¿En qué podemos ayudarle hoy?";
export const DEFAULT_HUMAN_TIMEOUT_HOURS = 24;

const CACHE_TTL = 60 * 1000; // 60 segundos

let cachedGlobal: BotSettings | null = null;
let lastGlobalFetch = 0;

const channelCache = new Map<Platform, { data: BotSettings; fetchedAt: number }>();

function buildFallback(): BotSettings {
  return {
    system_prompt: process.env.SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
    welcome_message: process.env.WELCOME_MESSAGE ?? DEFAULT_WELCOME_MESSAGE,
    human_timeout_hours: Number(process.env.HUMAN_TIMEOUT_HOURS) || DEFAULT_HUMAN_TIMEOUT_HOURS,
    llm_model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    host_phone: process.env.HOST_PHONE || "",
    escalation_phrases: JSON.stringify([
      "conectarte con uno de nuestros asesores",
      "hablar con un especialista",
      "déjame conectarte con ventas",
      "necesito un presupuesto",
      "quiero una cotización",
      "hablar con el equipo técnico",
      "asesor de ventas",
      "contacto directo"
    ]),
  };
}

export async function getActiveSettings(platform?: Platform): Promise<BotSettings> {
  const now = Date.now();

  // Si no hay plataforma, retornar config global con cache simple
  if (!platform) {
    if (cachedGlobal && now - lastGlobalFetch < CACHE_TTL) return cachedGlobal;
    const global = await getBotSettings();
    const result = global ?? buildFallback();
    cachedGlobal = result;
    lastGlobalFetch = now;
    return result;
  }

  // Cache por plataforma
  const cached = channelCache.get(platform);
  if (cached && now - cached.fetchedAt < CACHE_TTL) return cached.data;

  // Obtener config global
  const global = await getBotSettings() ?? buildFallback();

  // Obtener config del canal
  const ch = await getChannelSettings(platform);
  if (!ch) {
    channelCache.set(platform, { data: global, fetchedAt: now });
    return global;
  }

  // Merge: canal sobreescribe global solo donde tiene valor
  const merged: BotSettings = { ...global };

  if (ch.system_prompt) merged.system_prompt = ch.system_prompt;
  if (ch.welcome_message) merged.welcome_message = ch.welcome_message;
  if (ch.llm_model) merged.llm_model = ch.llm_model;
  if (ch.host_phone) merged.host_phone = ch.host_phone;

  try {
    const eps = JSON.parse(ch.escalation_phrases || "[]");
    if (Array.isArray(eps) && eps.length > 0) merged.escalation_phrases = ch.escalation_phrases;
  } catch {}

  try {
    const ops = JSON.parse(ch.offtopic_phrases || "[]");
    if (Array.isArray(ops) && ops.length > 0) merged.offtopic_phrases = ch.offtopic_phrases;
  } catch {}

  if (ch.offtopic_limit != null) merged.offtopic_limit = ch.offtopic_limit;

  channelCache.set(platform, { data: merged, fetchedAt: now });
  return merged;
}

/** Invalida el cache de una plataforma específica (llamar tras guardar channel settings) */
export function invalidateChannelCache(platform?: Platform): void {
  if (platform) {
    channelCache.delete(platform);
  } else {
    cachedGlobal = null;
    channelCache.clear();
  }
}
