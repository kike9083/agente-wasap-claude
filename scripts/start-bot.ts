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
} from "../src/lib/db";

const authDir = path.resolve(process.cwd(), "auth");

let handle: Awaited<ReturnType<typeof startBot>> | null = null;
let outboxInterval: NodeJS.Timeout | null = null;
let restartCheckInterval: NodeJS.Timeout | null = null;
let lastRestartFlag: number | null = null;

async function start() {
  try {
    console.log("[bot] Iniciando Baileys...");
    handle = await startBot(authDir, handleReconnect);
    console.log("[bot] Baileys iniciado");

    if (!outboxInterval) startOutboxPoller();
    if (!restartCheckInterval) startRestartChecker();
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

async function shutdown() {
  console.log("[bot] Apagando...");
  if (restartCheckInterval) clearInterval(restartCheckInterval);
  if (outboxInterval) clearInterval(outboxInterval);
  clearReconnectTimer();
  if (handle) {
    try { handle.sock.end(undefined); } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
