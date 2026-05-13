import OpenAI from "openai";
import { getActiveSettings } from "./system-prompt";
import { searchProducts } from "./db";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return _client;
}

/**
 * Cadena de fallback ordenada de más barato a más caro.
 * Si el modelo activo falla, se intenta el siguiente en la lista.
 */
export const FALLBACK_CHAIN = [
  "ibm-granite/granite-4.1-8b",       // $0.05/M  — principal
  "qwen/qwen3.5-9b",                   // $0.04/M
  "google/gemma-4-26b-a4b-it",         // $0.06/M
  "rekaai/reka-edge",                  // $0.10/M
  "google/gemma-4-31b-it",             // $0.12/M
  "openai/gpt-4o-mini",               // $0.15/M  — fallback final confiable
];

function isRetriableError(err: unknown): boolean {
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  // 429 rate limit, 5xx server errors, sin respuesta
  return !status || status === 429 || status >= 500;
}

function buildModelQueue(configuredModel: string): string[] {
  const idx = FALLBACK_CHAIN.indexOf(configuredModel);
  if (idx === -1) {
    // Modelo no está en la cadena: úsalo primero, luego toda la cadena
    return [configuredModel, ...FALLBACK_CHAIN];
  }
  // Empieza desde el modelo configurado y sigue hacia los más caros
  return FALLBACK_CHAIN.slice(idx);
}

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

async function callModel(model: string, initialMessages: any[]): Promise<string> {
  const response = await getClient().chat.completions.create({
    model,
    messages: initialMessages,
    temperature: 0.7,
    max_tokens: 512,
    tools: [
      {
        type: "function",
        function: {
          name: "searchAppwriteCatalog",
          description: "Busca productos en el catálogo de la tienda por nombre o categoría. Úsalo SIEMPRE que el cliente pida precios o modelos. Devuelve nombre, precio, sku y link.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Palabra clave a buscar (ej. 'aire acondicionado', 'cama', 'lavadora')",
              },
            },
            required: ["query"],
          },
        },
      },
    ],
  });

  const choice = response.choices?.[0];
  if (!choice) throw new Error(`El modelo ${model} no devolvió ninguna respuesta`);

  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    const msgs = [...initialMessages, choice.message];
    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.function.name === "searchAppwriteCatalog") {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`[openrouter] Buscando catálogo: "${args.query}"`);
          const results = await searchProducts(args.query);
          const toolResultStr = results.length === 0
            ? `No se encontraron productos para "${args.query}". Ofrécele al cliente revisar otras opciones o escalalo a la asesora.`
            : results.slice(0, 5).map(p => `- ${p.name} (SKU: ${p.sku}) | Precio: ${p.price} | Link: ${p.url || "No disponible"}`).join("\n");
          msgs.push({ role: "tool", tool_call_id: toolCall.id, content: toolResultStr });
        } catch {
          msgs.push({ role: "tool", tool_call_id: toolCall.id, content: "Error buscando productos." });
        }
      }
    }
    const second = await getClient().chat.completions.create({ model, messages: msgs, temperature: 0.7, max_tokens: 512 });
    return stripChainOfThought(second.choices?.[0]?.message?.content || "");
  }

  const raw = choice.message.content;
  if (!raw) throw new Error(`El modelo ${model} no devolvió contenido`);
  return stripChainOfThought(raw);
}

export async function generateReply(
  history: Message[],
  userMessage: string
): Promise<string> {
  const activeSettings = await getActiveSettings();
  const configuredModel = activeSettings.llm_model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const systemPrompt = activeSettings.system_prompt;

  const initialMessages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  const queue = buildModelQueue(configuredModel);
  let lastError: unknown;

  for (const model of queue) {
    try {
      const reply = await callModel(model, initialMessages);
      if (model !== configuredModel) {
        console.warn(`[openrouter] Fallback activo — usando ${model} (configurado: ${configuredModel})`);
      }
      return reply;
    } catch (err) {
      const status = (err as any)?.status ?? (err as any)?.response?.status ?? "?";
      console.error(`[openrouter] Modelo ${model} falló (status ${status}) — probando siguiente`);
      lastError = err;
      if (!isRetriableError(err)) break; // error no retriable (ej. 400 bad request): no seguir
    }
  }

  throw lastError;
}
