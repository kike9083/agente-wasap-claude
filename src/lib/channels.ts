export type Channel = "whatsapp" | "telegram" | "webchat";

const ALL: Channel[] = ["whatsapp", "telegram", "webchat"];

/**
 * Lee ENABLED_CHANNELS del entorno y devuelve los canales activos.
 * Si la variable no está definida → todos los canales activos (backward compat).
 * Ejemplo: ENABLED_CHANNELS=whatsapp,telegram
 */
export function getEnabledChannels(): Channel[] {
  const raw = process.env.ENABLED_CHANNELS;
  if (!raw) return [...ALL];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Channel => ALL.includes(s as Channel));
}

export function isChannelEnabled(channel: Channel): boolean {
  return getEnabledChannels().includes(channel);
}
