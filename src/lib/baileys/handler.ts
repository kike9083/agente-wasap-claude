import { WASocket, downloadMediaMessage } from "@whiskeysockets/baileys";
import { resolveJid } from "./client";
import {
  getOrCreateConversation,
  insertMessage,
  setMode,
  getNextEscalationAgent,
} from "../db";
import { getActiveSettings } from "../system-prompt";
import { storage, BUCKET_ID } from "../appwrite";
import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { processMessage } from "../core/message-processor";
import OpenAI from "openai";
import fs from "fs";
import os from "os";
import path from "path";
import { generateQuotePDF } from "../generate-quote-pdf";

const groqClient = process.env.GROQ_API_KEY ? new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
}) : null;

async function notifyHost(
  sock: WASocket,
  clientName: string,
  clientPhone: string,
  lastMessage: string,
  conversationId?: string
) {
  const settings = await getActiveSettings();
  const agentPhone = await getNextEscalationAgent();
  const hostPhone = agentPhone || settings.host_phone || process.env.HOST_PHONE;
  if (!hostPhone) return;

  const resolvedPhone = resolveJid(clientPhone);
  const isLid = resolvedPhone.endsWith("@lid");
  const displayNumber = resolvedPhone
    .replace(/@s\.whatsapp\.net$/, "")
    .replace(/@lid$/, "");
  const phoneLabel = isLid
    ? `${displayNumber} (abre el dashboard para ver el contacto)`
    : `+${displayNumber}`;

  // Generar resumen de la conversación si hay historial disponible
  let summaryText = "";
  if (conversationId) {
    try {
      const { getRecentHistory } = await import("../db");
      const { generateConversationSummary } = await import("../openrouter");
      const history = await getRecentHistory(conversationId, 10);
      const summary = await generateConversationSummary(history);
      if (summary) summaryText = `\n\n📋 Resumen de la conversación:\n${summary}`;
    } catch { /* si falla el resumen, continúa sin él */ }
  }

  // Incluir datos del cliente del CRM si están disponibles
  let customerText = "";
  if (conversationId) {
    try {
      const { getCustomerByConversation } = await import("../db");
      const customer = await getCustomerByConversation(conversationId);
      if (customer) {
        customerText =
          `\n\n👤 Datos del cliente (CRM):\n` +
          `• Nombre: ${customer.nombre} ${customer.apellido}\n` +
          `• Tel: ${customer.telefonoCelular}`;
      }
    } catch {}
  }

  const dashboardUrl = process.env.DASHBOARD_URL || "https://varios-agente-wasap-omni.fjueze.easypanel.host";
  const text =
    `[TechPadah] Atencion requerida\n\n` +
    `Cliente: ${clientName}\n` +
    `Numero: ${phoneLabel}\n` +
    `Ultimo mensaje: "${lastMessage}"` +
    `${customerText}` +
    `${summaryText}\n\n` +
    `Responde desde el dashboard:\n${dashboardUrl}`;

  try {
    await sock.sendMessage(`${hostPhone}@s.whatsapp.net`, { text });
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
      const remoteJid = msg.key?.remoteJid ?? "";
      if (msg.key.fromMe) continue;
      if (!remoteJid) continue;
      if (remoteJid.endsWith("@g.us")) continue;
      if (!remoteJid.endsWith("@s.whatsapp.net") && !remoteJid.endsWith("@lid")) continue;

      const msgTimestamp = Number(msg.messageTimestamp ?? 0);
      if (type === "append" && now - msgTimestamp > 60) continue;

      const possibleJid = remoteJid.endsWith("@lid") && msg.key?.participant
        ? msg.key.participant
        : remoteJid;
      const phone = resolveJid(possibleJid);
      const pushName = msg.pushName || "Usuario";

      let text: string | null =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        null;
      const isImage = !!msg.message?.imageMessage;
      const isAudio = !!msg.message?.audioMessage;

      if (!text && !isImage && !isAudio) continue;

      const { conversation: convo, isNew } = await getOrCreateConversation(
        "whatsapp",
        phone,
        pushName,
        phone
      );

      // ── Imágenes ─────────────────────────────────────────────────────────
      if (isImage) {
        console.log(`[bot] ← Imagen de ${phone}`);
        try {
          const buffer = await downloadMediaMessage(msg, "buffer", {}, {
            logger: console as any,
            reuploadRequest: sock.updateMediaMessage,
          });
          const file = await storage.createFile(
            BUCKET_ID, ID.unique(),
            InputFile.fromBuffer(buffer as Buffer, "image.jpeg")
          );
          await insertMessage(convo.id, "user", `[IMAGEN: ${file.$id}]` + (text ? ` ${text}` : ""));

          const settings = await getActiveSettings();
          const hostPhone = settings.host_phone || process.env.HOST_PHONE;
          if (hostPhone) {
            const resolvedPhone = resolveJid(phone);
            const displayNumber = resolvedPhone.replace(/@s\.whatsapp\.net$/, "").replace(/@lid$/, "");
            const phoneLabel = resolvedPhone.endsWith("@lid")
              ? `${displayNumber} (abre el dashboard)`
              : `+${displayNumber}`;
            await sock.sendMessage(`${hostPhone}@s.whatsapp.net`, {
              text: `[TechPadah] Imagen recibida\n\nCliente: ${pushName} (${phoneLabel})\nRevisa el dashboard.`,
            });
          }
          await setMode(convo.id, "HUMAN");
        } catch (e) {
          console.error("[bot] Error guardando imagen:", e);
        }
        continue;
      }

      // ── Audios ────────────────────────────────────────────────────────────
      if (isAudio) {
        console.log(`[bot] ← Audio de ${phone}`);
        if (!groqClient) {
          console.log(`[bot] Audio ignorado: GROQ_API_KEY no configurado`);
          continue;
        }
        try {
          const buffer = await downloadMediaMessage(msg, "buffer", {}, {
            logger: console as any,
            reuploadRequest: sock.updateMediaMessage,
          });
          const tempPath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);
          fs.writeFileSync(tempPath, buffer as Buffer);
          const transcription = await groqClient.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: "whisper-large-v3",
          });
          text = transcription.text;
          fs.unlinkSync(tempPath);
          console.log(`[bot] Audio transcrito: "${text}"`);
        } catch (e) {
          console.error("[bot] Error transcribiendo audio:", e);
          continue;
        }
      }

      if (!text) continue;
      console.log(`[bot] ← ${phone} (${pushName}): "${text}"`);

      // ── Procesador central ────────────────────────────────────────────────
      await sock.sendPresenceUpdate("composing", remoteJid);
      const start = Date.now();

      const { replied, wasEscalation } = await processMessage({
        platform: "whatsapp",
        conversationId: convo.id,
        isNew,
        name: pushName,
        text,
        sendReply: async (replyText) => {
          const elapsed = Date.now() - start;
          const minTyping = Math.min(Math.max(replyText.length * 25, 800), 3500);
          const remaining = minTyping - elapsed;
          if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
          await sock.sendPresenceUpdate("paused", remoteJid);

          // Detectar marcadores especiales en la respuesta
          const cotizacionMatch = replyText.match(/\[COTIZACION:\s*(\{[\s\S]*\})\s*\]/i);
          const imageMatch = replyText.match(/\[IMAGEN:\s*([a-zA-Z0-9_-]+)\]/i);

          if (cotizacionMatch) {
            try {
              const pdfBuffer = await generateQuotePDF(JSON.parse(cotizacionMatch[1]));
              const clean = replyText.replace(cotizacionMatch[0], "").trim();
              if (clean) await sock.sendMessage(remoteJid, { text: clean });
              await sock.sendMessage(remoteJid, {
                document: pdfBuffer,
                mimetype: "application/pdf",
                fileName: "Cotizacion.pdf",
              });
            } catch {
              await sock.sendMessage(remoteJid, { text: replyText.replace(cotizacionMatch[0], "").trim() || replyText });
            }
          } else if (imageMatch) {
            try {
              const buf = Buffer.from(await storage.getFileDownload(BUCKET_ID, imageMatch[1]));
              const clean = replyText.replace(imageMatch[0], "").trim();
              await sock.sendMessage(remoteJid, { image: buf, caption: clean || undefined });
            } catch {
              await sock.sendMessage(remoteJid, { text: replyText });
            }
          } else {
            await sock.sendMessage(remoteJid, { text: replyText });
          }
        },
        onEscalation: async (clientName, lastMsg) => {
          await notifyHost(sock, clientName, phone, lastMsg, convo.id);
        },
      });

      if (!replied) {
        await sock.sendPresenceUpdate("paused", remoteJid);
      }

      if (wasEscalation) {
        console.log(`[bot] Escalación detectada para ${phone}`);
      }
    } catch (err) {
      console.error("[bot] Error procesando mensaje:", err);
    }
  }
}
