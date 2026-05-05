import "./env-loader";
import { Telegraf } from "telegraf";
import { getOrCreateConversation, getPendingOutbox, markOutboxSent, insertMessage } from "../src/lib/db";
import { processMessage } from "../src/lib/core/message-processor";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("[telegram] TELEGRAM_BOT_TOKEN no definido — proceso terminado");
  process.exit(0); // Salida limpia para no romper start:all si no está configurado
}

const bot = new Telegraf(token);

bot.on("text", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const name = ctx.from.first_name || ctx.from.username || "Usuario";
  const text = ctx.message.text;

  try {
    const { conversation: convo, isNew } = await getOrCreateConversation(
      "telegram",
      chatId,
      name
    );

    await processMessage({
      platform: "telegram",
      conversationId: convo.id,
      isNew,
      name,
      text,
      sendReply: async (reply) => {
        await ctx.reply(reply);
      },
      onEscalation: async (clientName, lastMsg) => {
        console.log(`[telegram] Escalación: ${clientName} — "${lastMsg}"`);
        // Notificar al propio usuario que será atendido por un humano
        await ctx.reply("Un asesor se pondrá en contacto contigo pronto. 😊");
      },
    });
  } catch (err) {
    console.error("[telegram] Error procesando mensaje:", err);
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

bot.launch().then(() => {
  console.log("[telegram] Bot iniciado ✅");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
