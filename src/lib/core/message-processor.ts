import {
  insertMessage,
  getConversationById,
  getRecentHistory,
  setMode,
  type Platform,
} from "../db";
import { generateReply } from "../openrouter";
import { getActiveSettings } from "../system-prompt";
import { sendPushToAll } from "../push";

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

export async function processMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageOutput> {
  const { platform, conversationId, isNew, name, text, sendReply, onEscalation } = input;

  const settings = await getActiveSettings();

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

  // ── Llamar al LLM ────────────────────────────────────────────────────────
  const history = await getRecentHistory(conversationId, 20);
  const reply = await generateReply(history, text);

  await insertMessage(conversationId, "assistant", reply);
  await sendReply(reply);

  // ── Detección de escalación ──────────────────────────────────────────────
  let phrases: string[] = [];
  try { phrases = JSON.parse(settings.escalation_phrases || "[]"); } catch {}

  const wasEscalation = phrases.some((p) => reply.toLowerCase().includes(p.toLowerCase()));

  if (wasEscalation) {
    await setMode(conversationId, "HUMAN");
    await onEscalation?.(name, text);
    await sendPushToAll({
      title: "⚠️ Atención requerida",
      body: `${name}: "${text.slice(0, 100)}"`,
      url: "/",
    }).catch(() => {});
  }

  return { replied: true, wasEscalation, wasWelcome: false };
}
