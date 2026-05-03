import "./env-loader";
import path from "node:path";
import fs from "node:fs";
import { startBot, clearReconnectTimer } from "../src/lib/baileys/client";
import {
  getPendingOutbox,
  markOutboxSent,
  db,
  getConnectionState,
  setConnectionState,
} from "../src/lib/db";

const authDir = path.resolve(process.cwd(), "auth");
const restartFlagPath = path.resolve(process.cwd(), "data/.restart");

let handle: Awaited<ReturnType<typeof startBot>> | null = null;
let outboxInterval: NodeJS.Timeout | null = null;
let restartCheckInterval: NodeJS.Timeout | null = null;

async function start() {
  try {
    const authPath = authDir;
    console.log("[bot] Iniciando Baileys...");
    handle = await startBot(authPath);
    console.log("[bot] Baileys iniciado");

    startOutboxPoller();
    startRestartChecker();
  } catch (err) {
    console.error("[bot] Error iniciando Baileys:", err);
    process.exit(1);
  }
}

function startOutboxPoller() {
  if (outboxInterval) clearInterval(outboxInterval);

  outboxInterval = setInterval(async () => {
    if (!handle) return;

    try {
      const pending = getPendingOutbox(20);
      for (const item of pending) {
        try {
          const jid = `${item.phone}@s.whatsapp.net`;
          await handle.sock.sendMessage(jid, { text: item.content });
          markOutboxSent(item.id);
          console.log(
            `[bot] → Mensaje outbox enviado a ${item.phone} (ID: ${item.id})`
          );
        } catch (err) {
          console.error(
            `[bot] Error enviando outbox ${item.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    } catch (err) {
      console.error("[bot] Error en outbox poller:", err);
    }
  }, 2000);
}

function startRestartChecker() {
  if (restartCheckInterval) clearInterval(restartCheckInterval);

  restartCheckInterval = setInterval(async () => {
    if (fs.existsSync(restartFlagPath)) {
      console.log("[bot] Flag .restart detectado, reconectando...");
      fs.unlinkSync(restartFlagPath);

      if (handle) {
        try {
          await handle.shutdown();
        } catch {}
        handle = null;
      }

      clearReconnectTimer();
      if (outboxInterval) clearInterval(outboxInterval);
      if (restartCheckInterval) clearInterval(restartCheckInterval);

      try {
        fs.rmSync(authDir, { recursive: true, force: true });
      } catch {}

      await start();
    }
  }, 1000);
}

async function shutdown() {
  console.log("[bot] Apagando...");

  if (restartCheckInterval) clearInterval(restartCheckInterval);
  if (outboxInterval) clearInterval(outboxInterval);

  if (handle) {
    try {
      await handle.shutdown();
    } catch {}
  }

  db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start();
