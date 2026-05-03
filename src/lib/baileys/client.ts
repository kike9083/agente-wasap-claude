import {
  makeWASocket,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  WASocket,
} from "@whiskeysockets/baileys";
import { setConnectionState, getConnectionState } from "../db";
import pino from "pino";

const logger = pino({ level: "silent" });

export interface BaileysHandle {
  sock: WASocket;
  shutdown: () => Promise<void>;
}

let reconnectTimer: NodeJS.Timeout | null = null;

async function createSocket(authPath: string): Promise<BaileysHandle> {
  let version: [number, number, number] | undefined;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log("[bot] Versión Baileys obtenida:", version.join("."));
  } catch (err) {
    console.warn("[bot] No se pudo obtener última versión:", err);
  }

  const { useMultiFileAuthState } = await import("@whiskeysockets/baileys");

  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnectReason, qr } = update;

    if (qr) {
      console.log("[bot] QR Generado");
      setConnectionState({ status: "qr", qr_string: qr, phone: null });
    }

    if (connection === "connecting") {
      const current = getConnectionState();
      if (current.status === "disconnected") {
        console.log("[bot] Conectando...");
        setConnectionState({ status: "connecting" });
      }
    }

    if (connection === "open") {
      console.log("[bot] Conectado");
      const phone = sock.user?.id?.split(":")[0];
      setConnectionState({
        status: "connected",
        qr_string: null,
        phone: phone || null,
      });
    }

    if (connection === "close") {
      const code = (lastDisconnectReason as any)?.error?.statusCode;
      console.log("[bot] Desconectado, code:", code);

      if (code === DisconnectReason.loggedOut) {
        console.log("[bot] Sesión cerrada (401), limpiando...");
        setConnectionState({
          status: "disconnected",
          qr_string: null,
          phone: null,
        });
        return;
      }

      const delay = code === 440 ? 15000 : 5000;
      scheduleReconnect(delay);
    }
  });

  sock.ev.on("messages.upsert", async (m: any) => {
    const handler = (await import("./handler")).default;
    await handler(sock, m.messages);
  });

  return {
    sock,
    shutdown: async () => {
      try {
        await sock.logout();
      } catch {}
      try {
        sock.end(undefined);
      } catch {}
    },
  };
}

function scheduleReconnect(delay: number) {
  if (reconnectTimer) return;
  console.log(`[bot] Reintentando en ${delay}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    console.log("[bot] Reconectando...");
  }, delay);
}

export async function startBot(authPath: string): Promise<BaileysHandle> {
  return createSocket(authPath);
}

export function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
