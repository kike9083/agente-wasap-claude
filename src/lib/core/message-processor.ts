import {
  insertMessage,
  getConversationById,
  getRecentHistory,
  setMode,
  notifyHostViaOutbox,
  incrementOfftopicCount,
  resetOfftopicCount,
  type Platform,
} from "../db";
import { generateReply } from "../openrouter";
import { getActiveSettings } from "../system-prompt";
import { sendPushToAll } from "../push";
import { handleConvState, isSchedulingTrigger, startRegistrationFlow } from "./conversation-state";

export interface ProcessMessageInput {
  platform: Platform;
  conversationId: string;
  isNew: boolean;
  name: string;
  text: string;
  /** Callback para enviar la respuesta por el canal correspondiente */
  sendReply: (text: string) => Promise<void>;
  /** Callback opcional para notificación de escalación específica del canal */
  onEscalation?: (clientName: string, lastMessage: string) => Promise<void>;
}

export interface ProcessMessageOutput {
  replied: boolean;
  wasEscalation: boolean;
  wasWelcome: boolean;
}

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export async function processMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageOutput> {
  const { platform, conversationId, isNew, name, text, sendReply, onEscalation } = input;

  const settings = await getActiveSettings(platform);

  // ── Bienvenida (solo primer contacto) ───────────────────────────────────
  if (isNew && settings.welcome_message) {
    await insertMessage(conversationId, "user", text);
    const greeting = settings.welcome_message.replace("{name}", name.split(" ")[0]);
    await sendReply(greeting);
    await insertMessage(conversationId, "assistant", greeting);
    return { replied: true, wasEscalation: false, wasWelcome: true };
  }

  // Guardar mensaje del usuario
  await insertMessage(conversationId, "user", text);

  // ── Verificar modo ───────────────────────────────────────────────────────
  const fresh = await getConversationById(conversationId);
  if (!fresh || fresh.mode !== "AI") {
    return { replied: false, wasEscalation: false, wasWelcome: false };
  }

  // ── Flujo de registro y agendamiento ────────────────────────────────────
  if (fresh.conv_state) {
    const consumed = await handleConvState(fresh, text, sendReply);
    if (consumed) return { replied: true, wasEscalation: false, wasWelcome: false };
  } else if (isSchedulingTrigger(text, settings.scheduling_phrases)) {
    await startRegistrationFlow(conversationId, sendReply);
    return { replied: true, wasEscalation: false, wasWelcome: false };
  }

  // ── Llamar al LLM ────────────────────────────────────────────────────────
  const history = await getRecentHistory(conversationId, 20);
  let reply = await generateReply(history, text);

  // ── Detección de escalación ──────────────────────────────────────────────
  let phrases: string[] = [];
  try { phrases = JSON.parse(settings.escalation_phrases || "[]"); } catch {}
  const wasEscalation = phrases.some((p) => normalize(reply).includes(normalize(p)));

  // ── Detección de off-topic y límite de intentos ──────────────────────────
  let forceEscalation = false;
  if (!wasEscalation) {
    let offtopicPhrases: string[] = [];
    try { offtopicPhrases = JSON.parse(settings.offtopic_phrases || "[]"); } catch {}
    const limit = settings.offtopic_limit ?? 3;

    const wasOfftopic = offtopicPhrases.length > 0 &&
      offtopicPhrases.some((p) => normalize(reply).includes(normalize(p)));

    if (wasOfftopic) {
      const newCount = await incrementOfftopicCount(conversationId);
      if (newCount >= limit) {
        forceEscalation = true;
        reply = "Has enviado varias consultas fuera de nuestros servicios. Dejame conectarte con un asesor de TechPadah para atenderte mejor.";
      }
    }
  }

  await insertMessage(conversationId, "assistant", reply);
  await sendReply(reply);

  const didEscalate = wasEscalation || forceEscalation;

  if (didEscalate) {
    await setMode(conversationId, "HUMAN");
    await resetOfftopicCount(conversationId);
    await onEscalation?.(name, text);
    if (platform !== "whatsapp") {
      await notifyHostViaOutbox(platform, name, text, conversationId).catch((err) => {
        console.error("[message-processor] Error encolando notificación al host:", err);
      });
    }
    await sendPushToAll({
      title: "Atencion requerida",
      body: `${name} (${platform}): "${text.slice(0, 100)}"`,
      url: "/",
    }).catch(() => {});
  }

  return { replied: true, wasEscalation: didEscalate, wasWelcome: false };
}
