import { WASocket, proto } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  insertMessage,
  getConversationById,
  getRecentHistory,
} from "../db";
import { generateReply } from "../openrouter";

export default async function handleMessage(
  sock: WASocket,
  m: proto.IWebMessageInfo[]
) {
  for (const msg of m) {
    if (msg.key.fromMe) continue;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) continue;

    if (remoteJid.endsWith("@g.us")) continue;

    if (!remoteJid.endsWith("@s.whatsapp.net")) continue;

    const text =
      msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!text) continue;

    const phone = remoteJid.replace("@s.whatsapp.net", "");
    const pushName = msg.pushName || "Usuario";

    console.log(`[bot] ← Mensaje de ${phone} (${pushName}): "${text}"`);

    const convo = getOrCreateConversation(phone, pushName);

    insertMessage(convo.id, "user", text);

    const fresh = getConversationById(convo.id);
    if (!fresh || fresh.mode !== "AI") {
      console.log(
        `[bot] Conversación en modo ${fresh?.mode || "UNKNOWN"}, ignorando`
      );
      continue;
    }

    try {
      const history = getRecentHistory(convo.id, 20);
      console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);

      const start = Date.now();
      const reply = await generateReply(history, text);
      const elapsed = Date.now() - start;

      console.log(
        `[bot] LLM respondió en ${elapsed}ms: "${reply.substring(0, 50)}..."`
      );

      insertMessage(convo.id, "assistant", reply);

      await sock.sendMessage(remoteJid, { text: reply });
      console.log(`[bot] → Enviado a ${phone}`);
    } catch (err) {
      console.error(`[bot] Error generando respuesta:`, err);
    }
  }
}
