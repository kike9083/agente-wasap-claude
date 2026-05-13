import "./env-loader";
import { Telegraf } from "telegraf";
import { isChannelEnabled } from "../src/lib/channels";
import { getOrCreateConversation, getPendingOutbox, markOutboxSent, insertMessage } from "../src/lib/db";
import { processMessage } from "../src/lib/core/message-processor";
import OpenAI from "openai";
import fs from "fs";
import os from "os";
import path from "path";
import https from "https";

const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const token = process.env.TELEGRAM_BOT_TOKEN;
const telegramEnabled = isChannelEnabled("telegram");

console.log(`[telegram] ENABLED_CHANNELS=${process.env.ENABLED_CHANNELS ?? "(no definido)"}`);
console.log(`[telegram] token=${token ? "definido" : "NO definido"}, enabled=${telegramEnabled}`);

if (!token || !telegramEnabled) {
  const reason = !telegramEnabled
    ? "Telegram no incluido en ENABLED_CHANNELS (plan básico)"
    : "TELEGRAM_BOT_TOKEN no definido";
  console.log(`[telegram] ${reason} — bot desactivado`);
  // setInterval mantiene el event loop vivo sin top-level await
  // (Node.js 22 termina el proceso con código 13 si detecta una Promise que nunca se resuelve)
  setInterval(() => {}, 2147483647);
} else {
  const bot = new Telegraf(token!);

  function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(url, (res) => {
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      }).on("error", reject);
    });
  }

  async function handleConversation(
    chatId: string,
    name: string,
    text: string,
    ctx: { reply: (t: string) => Promise<unknown> }
  ) {
    const { conversation: convo, isNew } = await getOrCreateConversation(
      "telegram",
      chatId,
      name
    );
    console.log(`[telegram] Conversación: ${convo.id} (nueva=${isNew})`);
    await processMessage({
      platform: "telegram",
      conversationId: convo.id,
      isNew,
      name,
      text,
      sendReply: async (reply) => {
        console.log(`[telegram] → ${chatId}: "${reply.slice(0, 60)}..."`);
        await ctx.reply(reply);
      },
      onEscalation: async (clientName, lastMsg) => {
        console.log(`[telegram] Escalación: ${clientName} — "${lastMsg}"`);
        await ctx.reply("Un asesor se pondrá en contacto contigo pronto. 😊");
      },
    });
  }

  bot.on("text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const name = ctx.from.first_name || ctx.from.username || "Usuario";
    const text = ctx.message.text;
    console.log(`[telegram] ← ${chatId} (${name}): "${text}"`);
    try {
      await handleConversation(chatId, name, text, ctx);
    } catch (err) {
      console.error("[telegram] Error procesando mensaje:", err);
    }
  });

  bot.on("voice", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const name = ctx.from.first_name || ctx.from.username || "Usuario";
    console.log(`[telegram] ← ${chatId} (${name}): [nota de voz]`);

    if (!process.env.GROQ_API_KEY) {
      console.warn("[telegram] GROQ_API_KEY no definido — nota de voz ignorada");
      await ctx.reply("Lo siento, no puedo procesar notas de voz en este momento.");
      return;
    }

    let tempPath: string | null = null;
    try {
      const fileId = ctx.message.voice.file_id;
      const fileUrl = await ctx.telegram.getFileLink(fileId);
      tempPath = path.join(os.tmpdir(), `tg_voice_${Date.now()}.ogg`);
      await downloadFile(fileUrl.href, tempPath);

      const transcription = await groqClient.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: "whisper-large-v3",
      });
      const text = transcription.text.trim();
      console.log(`[telegram] Audio transcrito: "${text}"`);

      if (!text) {
        await ctx.reply("No pude entender el audio. ¿Puedes escribirlo?");
        return;
      }

      await handleConversation(chatId, name, text, ctx);
    } catch (err) {
      console.error("[telegram] Error procesando nota de voz:", err);
      await ctx.reply("Hubo un error procesando tu nota de voz. Por favor escribe tu consulta.");
    } finally {
      if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  });

  // Poller de outbox — permite responder desde el dashboard a Telegram
  setInterval(async () => {
    try {
      const pending = await getPendingOutbox("telegram");
      for (const item of pending) {
        try {
          await bot.telegram.sendMessage(item.phone, item.content);
          await insertMessage(item.conversation_id, "assistant", item.content);
          await markOutboxSent(item.id);
          console.log(`[telegram] Outbox enviado a chat ${item.phone}`);
        } catch (err) {
          console.error("[telegram] Error enviando outbox:", err);
        }
      }
    } catch {}
  }, 2000);

  function launchWithRetry(attempt = 0) {
    console.log(`[telegram] Conectando... (intento ${attempt + 1})`);
    bot.launch({ dropPendingUpdates: true })
      .then(() => console.log("[telegram] Bot iniciado ✅"))
      .catch((err: any) => {
        // 409: otra instancia todavía polling. Reintentar indefinidamente con backoff fijo de 30s.
        // zeroDowntime=false en EasyPanel garantiza que el contenedor viejo muera antes del nuevo,
        // así el 409 se resuelve en el primer o segundo reintento.
        if (err?.response?.error_code === 409) {
          const delay = 30000;
          console.warn(`[telegram] 409 Conflict — reintentando en ${delay / 1000}s (intento ${attempt + 1})`);
          setTimeout(() => launchWithRetry(attempt + 1), delay);
        } else {
          console.error("[telegram] Error fatal en bot:", err.message ?? err);
          // No llamar process.exit — mantener el contenedor vivo para WhatsApp y Web
        }
      });
  }

  console.log("[telegram] Iniciando long polling...");
  launchWithRetry();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
