import { WASocket, downloadMediaMessage } from "@whiskeysockets/baileys";
import { resolveJid } from "./client";
import {
  getOrCreateConversation,
  insertMessage,
  getConversationById,
  getRecentHistory,
} from "../db";
import { generateReply } from "../openrouter";
import { getActiveSettings } from "../system-prompt";
import { sendPushToAll } from "../push";
import OpenAI from "openai";
import { storage, BUCKET_ID } from "../appwrite";
import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import fs from "fs";
import os from "os";
import path from "path";
import { generateQuotePDF } from "../generate-quote-pdf";

const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

async function isEscalation(reply: string): Promise<boolean> {
  const settings = await getActiveSettings();
  let phrases: string[] = [];
  try {
    phrases = JSON.parse(settings.escalation_phrases || "[]");
  } catch {
    phrases = [];
  }
  
  const lower = reply.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase.toLowerCase()));
}

async function notifyHost(
  sock: WASocket,
  clientName: string,
  clientPhone: string,
  lastMessage: string
) {
  const settings = await getActiveSettings();
  const hostPhone = settings.host_phone || process.env.HOST_PHONE;
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

async function notifyImageHost(
  sock: WASocket,
  clientName: string,
  clientPhone: string
) {
  const settings = await getActiveSettings();
  const hostPhone = settings.host_phone || process.env.HOST_PHONE;
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
  const text = `[Jaiger House] Imagen recibida 📷\n\nEl cliente ${clientName} (${phoneLabel}) acaba de enviar una imagen.\nRevisa el dashboard para verla.`;

  try {
    await sock.sendMessage(jid, { text });
  } catch (err) {
    console.error("[bot] Error enviando notificacion de imagen:", err);
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

      // Intentar extraer el número real si el remoteJid es un LID (a veces viene en participant)
      const possibleJid = remoteJid.endsWith("@lid") && msg.key?.participant ? msg.key.participant : remoteJid;
      const phone = resolveJid(possibleJid);
      const pushName = msg.pushName || "Usuario";

      let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || null;
      let isImage = !!msg.message?.imageMessage;
      let isAudio = !!msg.message?.audioMessage;

      if (!text && !isImage && !isAudio) continue;

      const { conversation: convo, isNew } = await getOrCreateConversation(phone, pushName);

      // --- MANEJO DE IMAGENES ---
      if (isImage) {
        console.log(`[bot] ← Imagen recibida de ${phone}`);
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', { }, { logger: console as any, reuploadRequest: sock.updateMediaMessage });
          // Subir a Appwrite Storage
          const file = await storage.createFile(BUCKET_ID, ID.unique(), InputFile.fromBuffer(buffer as Buffer, "image.jpeg"));
          const imageUrl = `[IMAGEN: ${file.$id}]`;
          
          await insertMessage(convo.id, "user", imageUrl + (text ? ` ${text}` : ""));
          
          // Notificar siempre al host
          await notifyImageHost(sock, pushName, phone);
        } catch (e) {
          console.error("[bot] Error guardando imagen:", e);
        }
        continue; // Terminamos aquí, el bot NO responde a imágenes.
      }

      // --- MANEJO DE AUDIOS ---
      if (isAudio) {
        console.log(`[bot] ← Audio recibido de ${phone}`);
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', { }, { logger: console as any, reuploadRequest: sock.updateMediaMessage });
          // Groq / OpenAI requiere un archivo con nombre válido para la transcripción
          const tempFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);
          fs.writeFileSync(tempFilePath, buffer as Buffer);

          const transcription = await groqClient.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-large-v3",
          });
          text = transcription.text;
          fs.unlinkSync(tempFilePath);

          console.log(`[bot] Audio transcrito: "${text}"`);
        } catch (e) {
          console.error("[bot] Error transcribiendo audio:", e);
          continue;
        }
      }

      console.log(`[bot] ← Mensaje de ${phone} (${pushName}): "${text}"`);

      // ── Mensaje de bienvenida (solo en el primer contacto) ──────────────
      const activeSettings = await getActiveSettings();
      if (isNew && activeSettings.welcome_message && !isImage) {
        await insertMessage(convo.id, "user", text); // Insertar primero el mensaje del usuario
        
        const greeting = activeSettings.welcome_message.replace("{name}", pushName.split(" ")[0]);
        console.log(`[bot] Primer contacto de ${phone} — enviando bienvenida`);
        await sock.sendPresenceUpdate("composing", remoteJid);
        await new Promise(r => setTimeout(r, 1200));
        await sock.sendPresenceUpdate("paused", remoteJid);
        await sock.sendMessage(remoteJid, { text: greeting });
        await insertMessage(convo.id, "assistant", greeting);
        continue; // 🛑 Detener el bucle aquí para evitar que el LLM responda también
      }
      await insertMessage(convo.id, "user", text);

      const fresh = await getConversationById(convo.id);
      if (!fresh || fresh.mode !== "AI") {
        console.log(`[bot] Modo ${fresh?.mode ?? "UNKNOWN"} — sin respuesta automática`);
        continue;
      }

      const history = await getRecentHistory(convo.id, 20);
      console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);

      // Mostrar "escribiendo..." mientras el LLM procesa
      await sock.sendPresenceUpdate("composing", remoteJid);
      const start = Date.now();
      const reply = await generateReply(history, text);
      const elapsed = Date.now() - start;

      console.log(`[bot] LLM respondió en ${elapsed}ms`);

      // Garantizar un mínimo de tiempo de "escritura" proporcional al largo de la respuesta
      const minTypingMs = Math.min(Math.max(reply.length * 25, 800), 3500);
      const remaining = minTypingMs - elapsed;
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
      await sock.sendPresenceUpdate("paused", remoteJid);

      await insertMessage(convo.id, "assistant", reply);

      const cotizacionMatch = reply.match(/\[COTIZACION:\s*(\{[\s\S]*\})\s*\]/i);
      const imageMatch = reply.match(/\[IMAGEN:\s*([a-zA-Z0-9_-]+)\]/i);

      if (cotizacionMatch) {
        try {
          const quoteData = JSON.parse(cotizacionMatch[1]);
          const pdfBuffer = await generateQuotePDF(quoteData);
          const textWithoutMarker = reply.replace(cotizacionMatch[0], "").trim();

          if (textWithoutMarker) {
            await sock.sendMessage(remoteJid, { text: textWithoutMarker });
          }
          await sock.sendMessage(remoteJid, {
            document: pdfBuffer,
            mimetype: "application/pdf",
            fileName: "Cotizacion_NovaMente_AI.pdf",
          });
          console.log(`[bot] PDF cotización enviado a ${phone}`);
        } catch (e) {
          console.error("[bot] Error generando PDF de cotización:", e);
          await sock.sendMessage(remoteJid, {
            text: reply.replace(cotizacionMatch[0], "").trim() || reply,
          });
        }
      } else if (imageMatch) {
        const fileId = imageMatch[1];
        try {
          const arrayBuffer = await storage.getFileDownload(BUCKET_ID, fileId);
          const buffer = Buffer.from(arrayBuffer);
          const textWithoutImage = reply.replace(imageMatch[0], "").trim();

          await sock.sendMessage(remoteJid, {
            image: buffer,
            caption: textWithoutImage || undefined
          });
        } catch (e) {
          console.error("[bot] Error descargando imagen para enviar:", e);
          await sock.sendMessage(remoteJid, { text: reply });
        }
      } else {
        await sock.sendMessage(remoteJid, { text: reply });
      }
      
      console.log(`[bot] → Enviado a ${phone}`);

      if (await isEscalation(reply)) {
        console.log(`[bot] Escalacion detectada para ${phone} — notificando host`);
        await notifyHost(sock, pushName, phone, text);
        await sendPushToAll({
          title: "⚠️ Atención requerida",
          body: `${pushName}: "${text.slice(0, 100)}"`,
          url: "/",
        }).catch((err) => console.error("[bot] Error enviando push:", err));
      }
    } catch (err) {
      console.error(`[bot] Error procesando mensaje:`, err);
    }
  }
}
