import {
  makeWASocket,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  WASocket,
} from "@whiskeysockets/baileys";
import { setConnectionState, getConnectionState } from "../db";
import handleMessage from "./handler";
import pino from "pino";
import fs from "node:fs";

const logger = pino({ level: "silent" });

export interface BaileysHandle {
  sock: WASocket;
  shutdown: () => Promise<void>;
}

let reconnectTimer: NodeJS.Timeout | null = null;

// Mapeo LID → JID real (@s.whatsapp.net) que se llena con contacts.upsert
const lidToJid = new Map<string, string>();

/** Convierte un JID @lid al JID real si está disponible, si no devuelve el original */
export function resolveJid(jid: string): string {
  if (jid.endsWith("@lid")) {
    return lidToJid.get(jid) ?? jid;
  }
  return jid;
}

async function createSocket(
  authPath: string,
  onReconnect: (delay: number) => void
): Promise<BaileysHandle> {
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

  // Construir mapa LID → JID cuando WhatsApp sincroniza contactos
  const mapContact = (c: any) => {
    if (c.lid && c.id) {
      lidToJid.set(c.lid, c.id);
      console.log(`[bot] Contacto mapeado: ${c.lid} → ${c.id}`);
    }
  };

  sock.ev.on("contacts.upsert", (contacts: any[]) => contacts.forEach(mapContact));
  sock.ev.on("contacts.update", (contacts: any[]) => contacts.forEach(mapContact));

  sock.ev.on("connection.update", async (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("[bot] QR Generado");
      setConnectionState({ status: "qr", qr_string: qr, phone: null });
    }

    if (connection === "connecting") {
      getConnectionState().then((current) => {
        if (current.status === "disconnected") {
          console.log("[bot] Conectando...");
          setConnectionState({ status: "connecting" });
        }
      });
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
      const code = (lastDisconnect as any)?.error?.output?.statusCode;
      console.log("[bot] Desconectado, code:", code);

      if (code === DisconnectReason.loggedOut) {
        console.log("[bot] Sesión cerrada (401), limpiando auth y pidiendo QR nuevo...");
        await setConnectionState({ status: "disconnected", qr_string: null, phone: null });
        try { fs.rmSync(authPath, { recursive: true, force: true }); } catch {}
        scheduleReconnect(2000, onReconnect);
        return;
      }

      const delay = code === 440 ? 15000 : 5000;
      scheduleReconnect(delay, onReconnect);
    }
  });

  sock.ev.on("messages.upsert", async (m: any) => {
    await handleMessage(sock, m.messages ?? [], m.type ?? "notify");
  });

  return {
    sock,
    shutdown: async () => {
      try { sock.end(undefined); } catch {}
    },
  };
}

function scheduleReconnect(delay: number, onReconnect: (d: number) => void) {
  if (reconnectTimer) return;
  console.log(`[bot] Reintentando en ${delay}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    onReconnect(delay);
  }, delay);
}

export async function startBot(
  authPath: string,
  onReconnect: (delay: number) => void
): Promise<BaileysHandle> {
  return createSocket(authPath, onReconnect);
}

export function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}
