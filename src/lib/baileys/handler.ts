import { WASocket } from "@whiskeysockets/baileys";
import { resolveJid } from "./client";
import {
  getOrCreateConversation,
  insertMessage,
  getConversationById,
  getRecentHistory,
} from "../db";
import { generateReply } from "../openrouter";

const ESCALATION_PHRASES = [
  "conectarte con uno de nuestros hosts",
  "derivarte con un asesor humano",
  "déjame derivarte",
  "déjame conectarte",
];

function isEscalation(reply: string): boolean {
  const lower = reply.toLowerCase();
  return ESCALATION_PHRASES.some((phrase) => lower.includes(phrase));
}

async function notifyHost(
  sock: WASocket,
  clientName: string,
  clientPhone: string,
  lastMessage: string
) {
  const hostPhone = process.env.HOST_PHONE;
  if (!hostPhone) return;

  const resolvedPhone = resolveJid(clientPhone);
  const isLid = resolvedPhone.endsWith("@lid");
  const displayNumber = resolvedPhone
    .replace(/@s\.whatsapp\.net$/, "")
    .replace(/@lid$/, "");
  const phoneLabel = isLid
    ? `${displayNumber} (abre el dashboard para ver el contacto)`
    : `+${displayNumber}`;

  const jid = `${hostPhone}@s.whatsapp.net`;
  const text =
    `[Jaiger House] Atencion requerida\n\n` +
    `Cliente: ${clientName}\n` +
    `Numero: ${phoneLabel}\n` +
    `Ultimo mensaje: "${lastMessage}"\n\n` +
    `El bot no pudo resolver la consulta. Revisa el dashboard para responder.`;

  try {
    await sock.sendMessage(jid, { text });
    console.log(`[bot] Notificacion enviada al host (${hostPhone})`);
  } catch (err) {
    console.error("[bot] Error enviando notificacion al host:", err);
  }
}

export default async function handleMessage(
  sock: WASocket,
  messages: any[],
  type: string
) {
  const now = Math.floor(Date.now() / 1000);

  for (const msg of messages) {
    try {
      const remoteJid = msg.key?.remoteJid ?? "desconocido";

      if (msg.key.fromMe) continue;
      if (!remoteJid) continue;
      if (remoteJid.endsWith("@g.us")) continue;
      if (!remoteJid.endsWith("@s.whatsapp.net") && !remoteJid.endsWith("@lid")) continue;

      const msgTimestamp = Number(msg.messageTimestamp ?? 0);
      if (type === "append" && now - msgTimestamp > 60) continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        null;

      if (!text) continue;

      const phone = resolveJid(remoteJid);
      const pushName = msg.pushName || "Usuario";

      console.log(`[bot] ← Mensaje de ${phone} (${pushName}): "${text}"`);

      const convo = await getOrCreateConversation(phone, pushName);
      await insertMessage(convo.id, "user", text);

      const fresh = await getConversationById(convo.id);
      if (!fresh || fresh.mode !== "AI") {
        console.log(`[bot] Modo ${fresh?.mode ?? "UNKNOWN"} — sin respuesta automática`);
        continue;
      }

      const history = await getRecentHistory(convo.id, 20);
      console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);

      const start = Date.now();
      const reply = await generateReply(history, text);
      const elapsed = Date.now() - start;

      console.log(`[bot] LLM respondió en ${elapsed}ms`);

      await insertMessage(convo.id, "assistant", reply);
      await sock.sendMessage(remoteJid, { text: reply });
      console.log(`[bot] → Enviado a ${phone}`);

      if (isEscalation(reply)) {
        console.log(`[bot] Escalacion detectada para ${phone} — notificando host`);
        await notifyHost(sock, pushName, phone, text);
      }
    } catch (err) {
      console.error(`[bot] Error procesando mensaje:`, err);
    }
  }
}
