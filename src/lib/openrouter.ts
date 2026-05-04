import OpenAI from "openai";
import { getActiveSettings } from "./system-prompt";
import { searchProducts } from "./db";

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
  const messages: any[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const activeSettings = await getActiveSettings();
  const model = activeSettings.llm_model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  const systemPrompt = activeSettings.system_prompt + "\n\nINSTRUCCIÓN CRÍTICA: Tienes acceso a una herramienta para buscar productos. SI EL CLIENTE PREGUNTA POR UN PRODUCTO ESPECÍFICO (ej. aire acondicionado, cama, comedor, estufa, lavadora, colchón, etc.), DEBES usar OBLIGATORIAMENTE la herramienta 'searchAppwriteCatalog' para consultar el precio exacto y URL en tiempo real antes de responder. Nunca adivines precios ni asumas que no hay.";

  const initialMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  const response = await client.chat.completions.create({
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
  if (!choice) {
    console.error("[openrouter] Respuesta sin choices:", JSON.stringify(response));
    throw new Error(`El modelo ${model} no devolvió ninguna respuesta`);
  }

  // Handle tool calls
  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    initialMessages.push(choice.message); // Append assistant's tool call message
    
    for (const toolCall of choice.message.tool_calls) {
      if (toolCall.function.name === "searchAppwriteCatalog") {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`[bot] Buscando catálogo: "${args.query}"`);
          const results = await searchProducts(args.query);
          
          let toolResultStr = "";
          if (results.length === 0) {
            toolResultStr = `No se encontraron productos para "${args.query}". Ofrécele al cliente revisar otras opciones o escalalo a la asesora.`;
          } else {
            toolResultStr = results.slice(0, 5).map(p => `- ${p.name} (SKU: ${p.sku}) | Precio: ${p.price} | Link: ${p.url || 'No disponible'}`).join("\n");
          }

          initialMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResultStr,
          });
        } catch (e) {
           initialMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: "Error buscando productos en la base de datos.",
          });
        }
      }
    }

    // Call LLM again with tool results
    const secondResponse = await client.chat.completions.create({
      model,
      messages: initialMessages,
      temperature: 0.7,
      max_tokens: 512,
    });
    
    const finalRaw = secondResponse.choices?.[0]?.message?.content;
    return stripChainOfThought(finalRaw || "");
  }

  const raw = choice.message.content;
  if (!raw) {
    console.error("[openrouter] Choice sin content:", JSON.stringify(choice));
    throw new Error("No content in response");
  }

  return stripChainOfThought(raw);
}
