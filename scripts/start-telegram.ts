import "./env-loader";
import { Telegraf } from "telegraf";
import { isChannelEnabled } from "../src/lib/channels";
import { getOrCreateConversation, getPendingOutbox, markOutboxSent, insertMessage } from "../src/lib/db";
import { processMessage } from "../src/lib/core/message-processor";

const token = process.env.TELEGRAM_BOT_TOKEN;
const telegramEnabled = isChannelEnabled("telegram");

if (!token || !telegramEnabled) {
  const reason = !telegramEnabled
    ? "Telegram no incluido en ENABLED_CHANNELS (plan básico)"
    : "TELEGRAM_BOT_TOKEN no definido";
  console.log(`[telegram] ${reason} — bot desactivado`);
  // setInterval mantiene el event loop vivo sin top-level await
  // (Node.js 22 termina el proceso con código 13 si detecta una Promise que nunca se resuelve)
  setInterval(() => {}, 2147483647);
} else {
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

  launchWithRetry();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
