import { getBotSettings, BotSettings } from "./db";

// Fallback values
export const DEFAULT_SYSTEM_PROMPT = `
Eres el asistente virtual de NovaMente AI, una agencia de inteligencia artificial para negocios pequeños y medianos ubicada en Pedregal, Panamá.
`.trim();

export const DEFAULT_WELCOME_MESSAGE = "¡Hola {name}! Soy el asistente virtual de NovaMente AI. ¿En qué te puedo ayudar hoy?";
export const DEFAULT_HUMAN_TIMEOUT_HOURS = 24;

let cachedSettings: BotSettings | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 60 segundos

export async function getActiveSettings(): Promise<BotSettings> {
  const now = Date.now();
  if (cachedSettings && now - lastFetchTime < CACHE_TTL) {
    return cachedSettings;
  }

  const settings = await getBotSettings();
  if (settings) {
    cachedSettings = settings;
    lastFetchTime = now;
    return settings;
  }

  // Fallback if DB fails or is empty
  return {
    system_prompt: process.env.SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT,
    welcome_message: process.env.WELCOME_MESSAGE ?? DEFAULT_WELCOME_MESSAGE,
    human_timeout_hours: Number(process.env.HUMAN_TIMEOUT_HOURS) || DEFAULT_HUMAN_TIMEOUT_HOURS,
    llm_model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
  };
}

