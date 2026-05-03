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

export async function generateReply(
  history: Message[],
  userMessage: string
): Promise<string> {
  const messages: Message[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  const response = await client.chat.completions.create({
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 256,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No content in response");
  }

  return content;
}
