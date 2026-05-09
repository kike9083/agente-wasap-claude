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
import path from "node:path";

const logger = pino({ level: "silent" });

export interface BaileysHandle {
  sock: WASocket;
  shutdown: () => Promise<void>;
}

let reconnectTimer: NodeJS.Timeout | null = null;
let undefinedCodeStreak = 0;
let pendingAuthClear = false; // auth a borrar DESPUÉS de cerrar el socket
let hasEverConnected = false; // true si este socket llegó a estado "open"

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
  hasEverConnected = false;
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
      setConnectionState({ status: "qr", qr_string: qr, phone: null }).catch(() => {});
    }

    if (connection === "connecting") {
      getConnectionState()
        .then((current) => {
          if (current.status === "disconnected") {
            console.log("[bot] Conectando...");
            return setConnectionState({ status: "connecting" });
          }
        })
        .catch(() => {});
    }

    if (connection === "open") {
      console.log("[bot] Conectado");
      undefinedCodeStreak = 0;
      hasEverConnected = true;
      const phone = sock.user?.id?.split(":")[0];
      setConnectionState({
        status: "connected",
        qr_string: null,
        phone: phone || null,
      }).catch(() => {});
    }

    if (connection === "close") {
      const err = (lastDisconnect as any)?.error;
      const code = err?.output?.statusCode ?? err?.statusCode;
      console.log("[bot] Desconectado, code:", code, "| msg:", err?.message ?? "(sin error)");

      if (code === DisconnectReason.loggedOut) {
        if (hasEverConnected) {
          // La sesión fue revocada realmente → limpiar auth
          console.log("[bot] Sesión revocada (401 tras conexión activa), marcando auth para limpiar. Esperando 5 min...");
          pendingAuthClear = true;
        } else {
          // Nunca conectó → probablemente bloqueo de IP, conservar auth
          console.log("[bot] 401 sin conexión previa — posible bloqueo de IP, conservando auth. Esperando 5 min...");
        }
        hasEverConnected = false;
        undefinedCodeStreak = 0;
        await setConnectionState({ status: "disconnected", qr_string: null, phone: null });
        scheduleReconnect(300000, onReconnect); // 5 minutos — evita bloqueo de IP por exceso
        return;
      }

      if (code === undefined) {
        undefinedCodeStreak++;
        console.log(`[bot] Código desconocido (racha ${undefinedCodeStreak})`);
        if (undefinedCodeStreak >= 3) {
          console.log("[bot] Marcando auth para limpiar por fallos repetidos sin código...");
          undefinedCodeStreak = 0;
          pendingAuthClear = true;
          await setConnectionState({ status: "disconnected", qr_string: null, phone: null });
          scheduleReconnect(2000, onReconnect);
          return;
        }
      } else {
        undefinedCodeStreak = 0;
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

/** Borra el contenido del directorio auth (no el directorio en sí — es mount point en Docker) */
export function clearAuthContents(authPath: string): void {
  try {
    const files = fs.readdirSync(authPath);
    for (const f of files) {
      try { fs.unlinkSync(path.join(authPath, f)); } catch {}
    }
  } catch {}
}

/** Borra el auth si está pendiente (debe llamarse DESPUÉS de sock.end()) */
export function clearPendingAuth(authPath: string) {
  if (!pendingAuthClear) return;
  pendingAuthClear = false;
  clearAuthContents(authPath);
  console.log("[bot] Auth limpiado correctamente.");
}
