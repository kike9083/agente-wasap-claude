import "./env-loader";
import path from "node:path";
import fs from "node:fs";
import { startBot, clearReconnectTimer, resolveJid } from "../src/lib/baileys/client";
import {
  getPendingOutbox,
  markOutboxSent,
  insertMessage,
  setConnectionState,
  getRestartFlag,
  clearRestartFlag,
  listStaleHumanConversations,
  setMode,
} from "../src/lib/db";
import { getActiveSettings } from "../src/lib/system-prompt";

const authDir = path.resolve(process.cwd(), "auth");

let handle: Awaited<ReturnType<typeof startBot>> | null = null;
let outboxInterval: NodeJS.Timeout | null = null;
let restartCheckInterval: NodeJS.Timeout | null = null;
let timeoutInterval: NodeJS.Timeout | null = null;
let lastRestartFlag: number | null = null;

async function start() {
  try {
    console.log("[bot] Iniciando Baileys...");
    handle = await startBot(authDir, handleReconnect);
    console.log("[bot] Baileys iniciado");

    if (!outboxInterval) startOutboxPoller();
    if (!restartCheckInterval) startRestartChecker();
    if (!timeoutInterval) startTimeoutPoller();
  } catch (err) {
    console.error("[bot] Error iniciando Baileys:", err);
    setTimeout(() => start(), 5000);
  }
}

async function handleReconnect(_delay: number) {
  console.log("[bot] Reconectando...");
  if (handle) {
    try { handle.sock.end(undefined); } catch {}
    handle = null;
  }
  await start();
}

function startOutboxPoller() {
  outboxInterval = setInterval(async () => {
    if (!handle) return;
    try {
      const pending = await getPendingOutbox(20);
      for (const item of pending) {
        try {
          const jid = resolveJid(item.phone);
          await handle.sock.sendMessage(jid, { text: item.content });
          await insertMessage(item.conversation_id, "assistant", item.content);
          await markOutboxSent(item.id);
          console.log(`[bot] → Outbox enviado a ${item.phone}`);
        } catch (err) {
          console.error(`[bot] Error enviando outbox ${item.id}:`, err instanceof Error ? err.message : err);
        }
      }
    } catch (err) {
      console.error("[bot] Error en outbox poller:", err);
    }
  }, 2000);
}

function startRestartChecker() {
  restartCheckInterval = setInterval(async () => {
    try {
      const flag = await getRestartFlag();
      if (!flag || flag === lastRestartFlag) return;

      lastRestartFlag = flag;
      console.log("[bot] Reinicio solicitado desde dashboard...");
      await clearRestartFlag();

      clearReconnectTimer();

      if (handle) {
        try { handle.sock.end(undefined); } catch {}
        handle = null;
      }

      try { fs.rmSync(authDir, { recursive: true, force: true }); } catch {}

      await setConnectionState({ status: "disconnected", qr_string: null, phone: null });
      await start();
    } catch (err) {
      console.error("[bot] Error en restart checker:", err);
    }
  }, 2000);
}

function startTimeoutPoller() {
  timeoutInterval = setInterval(async () => {
    if (!handle) return;
    try {
      const activeSettings = await getActiveSettings();
      const timeoutHours = activeSettings.human_timeout_hours || 24;
      const timeoutSeconds = timeoutHours * 3600;
      const now = Math.floor(Date.now() / 1000);
      const cutoff = now - timeoutSeconds;
      const staleConvos = await listStaleHumanConversations(cutoff);

      for (const convo of staleConvos) {
        console.log(`[bot] Timeout alcanzado para ${convo.phone}. Regresando a modo AI...`);
        await setMode(convo.id, "AI");
        
        // Notify the user that the AI is back
        const returnMsg = "El asesor humano no está disponible en este momento. He vuelto para seguir ayudándote. ¿En qué más te puedo asistir?";
        const jid = resolveJid(convo.phone);
        await handle.sock.sendMessage(jid, { text: returnMsg });
        await insertMessage(convo.id, "assistant", returnMsg);
      }
    } catch (err) {
      console.error("[bot] Error en timeout poller:", err);
    }
  }, 60000); // Revisar cada minuto
}

async function shutdown() {
  console.log("[bot] Apagando...");
  if (restartCheckInterval) clearInterval(restartCheckInterval);
  if (outboxInterval) clearInterval(outboxInterval);
  if (timeoutInterval) clearInterval(timeoutInterval);
  clearReconnectTimer();
  if (handle) {
    try { handle.sock.end(undefined); } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
