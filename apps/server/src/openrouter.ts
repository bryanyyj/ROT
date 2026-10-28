import OpenAI from "openai";
import { config } from "./config.js";

/** OpenAI-compatible client pointed at OpenRouter. */
export function makeClient(): OpenAI {
  return new OpenAI({
    apiKey: config.openRouter.apiKey,
    baseURL: config.openRouter.baseUrl,
    defaultHeaders: {
      "HTTP-Referer": config.webOrigin,
      "X-Title": "ReadyOrRest",
    },
  });
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Stream a completion, yielding text deltas. Throws on API error. */
export async function* streamChat(messages: LlmMessage[]): AsyncGenerator<string> {
  const client = makeClient();
  const stream = await client.chat.completions.create({
    model: config.openRouter.model,
    messages,
    stream: true,
    temperature: 0.4,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/** Non-streaming completion (used for the weekly plan). */
export async function completeChat(messages: LlmMessage[]): Promise<string> {
  const client = makeClient();
  const res = await client.chat.completions.create({
    model: config.openRouter.model,
    messages,
    temperature: 0.4,
  });
  return res.choices[0]?.message?.content ?? "";
}
