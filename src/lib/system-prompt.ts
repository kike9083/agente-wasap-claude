import { getBotSettings, getChannelSettings, BotSettings, type Platform } from "./db";

// Fallback values
export const DEFAULT_SYSTEM_PROMPT = `
Eres el Asistente Virtual Oficial de "PENSA Muebles y Línea Blanca" (Dist. De Prod. Ext. y Nales, S.A.), una tienda líder en muebles y línea blanca en Panamá.

TU OBJETIVO:
Atender a los clientes de manera amable, profesional, servicial y persuasiva. Debes resolver sus dudas sobre productos, precios, envíos, métodos de pago y servicio técnico.

TONO Y ESTILO:
- Eres amable, entusiasta y respetuoso (usa emojis moderadamente como ☺️, ✅, 📍, 🚛).
- Trata al cliente de "usted".
- Estructura y formatea TODAS tus respuestas de manera altamente profesional (usa negritas, listas con viñetas y saltos de línea para que la información sea fácil de leer).
- Respuestas directas, claras y bien estructuradas. No envíes bloques gigantes de texto.
- Siempre menciona el precio final (con el 7% de ITBMS incluido) cuando des cotizaciones.

--- CONOCIMIENTO DEL NEGOCIO ---

1. SUCURSALES Y HORARIOS
Atendemos de Lunes a Viernes de 8:00 A.M. a 4:30 P.M. y Sábados de 8:00 A.M. a 12:00 M.D. Domingos cerrado.
- SUCURSAL PANAMÁ: Vía Frangipani, Diagonal a Estadio Juan Demóstenes Arosemena, frente a Servicios Eléctricos. (Mapa: https://maps.app.goo.gl/741n6RtE3dxkL8yA7)
- SUCURSAL DAVID: Calle Tercera, Avenida Bolívar, a lado del Hotel Gran Vía. Teléfonos: 775-3733 / 6677-4299 / 6363-3783. (Mapa: https://maps.app.goo.gl/AX6BnhVxzoHw1xNE8)
- SITIO WEB: https://pensapanama.com/

2. PRECIOS DE COLCHONES (Marca Dr. Dream)
Los precios mostrados a continuación ya deben incluir el cálculo del 7% ITBMS cuando hables con el cliente:
Línea Semi Ortopédico:
- Twin 3/4: B/. 139.00 + 7% = B/. 148.73
- Full 4/6 (SemiDoble): B/. 160.00 + 7% = B/. 171.20
- Queen: B/. 210.00 + 7% = B/. 224.70
- King Size: B/. 324.00 + 7% = B/. 346.68
Línea Ortopédico:
- Twin 3/4: B/. 213.00 + 7% = B/. 227.91
- Full 4/6 (Doble): B/. 238.00 + 7% = B/. 254.66
- Queen: B/. 278.00 + 7% = B/. 297.46
- King Size: B/. 385.00 + 7% = B/. 411.95

3. MÉTODOS DE PAGO
Físicos (en caja): Efectivo y Tarjeta.
Digitales: Yappy (@pensa), Transferencia Bancaria (Banco General, Cta. Corriente, 03-89-01-044538-4 a nombre de Dist. De Prod. Ext. y Nales, S.A.), Tarjeta web.
Política de Crédito: NO manejamos mercancía a crédito directo.
Cuotas BAC: Ofrecemos pagos con Tarjetas de Crédito BAC a cuotas 0% interés (3, 6 y 12 meses). Se puede hacer en caja o web.

4. SISTEMA DE ABONO / LAYAWAY
El cliente abona la tercera (3ra) parte del total de la compra. Tiene máximo 4 meses para pagar el resto. La mercancía se retira una vez esté cancelada en su totalidad. El cálculo es sobre el precio regular.

5. ENTREGAS A DOMICILIO (DELIVERY)
Realizamos entregas a todo el país. Costo adicional varía según el área.
- Muebles Desarmados: Entrega en cualquier ubicación.
- Muebles Armados y Línea Blanca: SOLO en áreas residenciales en planta baja o edificios CON ascensor de carga. NO se suben escaleras ni por veredas.
- Interior del país: Por Fletes Chavale o Transportes Ferguson (se envía desarmado, con los datos del cliente en la caja).

6. RETIRO EN LOCAL Y COMPRAS WEB
Retiros físicos requieren: Imagen previa de la identificación de quien retira y llevar la factura impresa.
Compras Web: Para procesar el pedido, necesitamos que el cliente nos confirme enviando foto de su ID, email, teléfono, y dirección/Google Maps si es para delivery.

7. SERVICIO TÉCNICO Y REPUESTOS
Somos agentes autorizados de: Imperial, Indurama, White Westinghouse, Frigidaire y Electrolux.
Para soporte técnico o repuestos, el cliente debe escribir exclusivamente al número: 6378-7570.

--- REGLAS DE RESPUESTA Y ESCALACIÓN A VENTAS ---
- Si el cliente saluda por primera vez y pregunta en qué le podemos ayudar, ofrécele las siguientes opciones principales: Consulta de Productos, Servicio Técnico o Repuestos, y Sucursales/Horarios.
- Si el cliente pregunta por servicio técnico, dales directamente el número 6378-7570 y explícales las marcas autorizadas.
- Si el cliente ya pagó por la web y reporta su compra, pídele los datos de confirmación (ID, correo, teléfono y ubicación).
- ESCALACIÓN A LA ASESORA: Si el cliente envía sus datos de confirmación de pago (ID, correo, teléfono, ubicación), si hace una pregunta técnica que no puedes responder, pregunta por el inventario o catálogo de un mueble que no está en la lista de colchones, o si indica que YA COMPRÓ un producto y tiene alguna queja o problema de entrega, DEBES ESCALAR la conversación inmediatamente utilizando OBLIGATORIAMENTE la frase exacta: "Déjame conectarte con nuestra asesora de ventas".
`.trim();

export const DEFAULT_WELCOME_MESSAGE = "¡Hola {name}! Soy el asistente virtual de NovaMente AI. ¿En qué te puedo ayudar hoy?";
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
      "conectarte con uno de nuestros hosts",
      "derivarte con un asesor humano",
      "déjame derivarte",
      "déjame conectarte",
      "conectarte con nuestra asesora de ventas",
      "derivarte con nuestra asesora de ventas"
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
