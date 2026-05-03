import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./system-prompt";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Elimina bloques de razonamiento interno que algunos modelos exponen en el contenido */
function stripChainOfThought(text: string): string {
  // Eliminar bloques <think>...</think> (DeepSeek, QwQ, etc.)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Si el contenido tiene una sección en inglés al inicio seguida de contenido en español,
  // intentar quedarnos solo con la parte final (después de la última línea en inglés)
  const lines = clean.split("\n");
  const lastEnglishIdx = lines.reduce((last, line, i) => {
    // Detectar líneas predominantemente en inglés (más palabras inglesas comunes)
    const englishPattern = /\b(the|user|asking|check|history|respond|response|Let me|Okay|Wait|need to|I should|I need|I can|I must|I am|my previous)\b/i;
    return englishPattern.test(line) ? i : last;
  }, -1);

  if (lastEnglishIdx >= 0 && lastEnglishIdx < lines.length - 1) {
    clean = lines.slice(lastEnglishIdx + 1).join("\n").trim();
  }

  return clean || text.trim();
}

export async function generateReply(
  history: Message[],
  userMessage: string
): Promise<string> {
  const messages: Message[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 512,
  });

  if (!response.choices || response.choices.length === 0) {
    console.error("[openrouter] Respuesta sin choices:", JSON.stringify(response));
    throw new Error(`El modelo ${model} no devolvió ninguna respuesta (¿límite alcanzado?)`);
  }

  const raw = response.choices[0].message.content;
  if (!raw) {
    console.error("[openrouter] Choice sin content:", JSON.stringify(response.choices[0]));
    throw new Error("No content in response");
  }

  return stripChainOfThought(raw);
}
