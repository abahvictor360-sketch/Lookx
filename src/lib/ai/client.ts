import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { serverEnv } from "@/lib/env";

export const MODEL = "claude-opus-5-5";

export class AiNotConfiguredError extends Error {}

/**
 * One structured-output call to Claude. Returns the parsed, schema-validated
 * JSON. Throws AiNotConfiguredError when no key is set, or any other error on
 * failure (callers fall back to non-AI output).
 */
export async function callClaudeJson<T>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  timeoutMs: number;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  let apiKey: string;
  try {
    apiKey = serverEnv.anthropicApiKey();
  } catch {
    throw new AiNotConfiguredError();
  }
  const client = new Anthropic({ apiKey, timeout: opts.timeoutMs, maxRetries: 1 });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: {
      effort: opts.effort ?? "low",
      format: { type: "json_schema", schema: opts.jsonSchema },
    },
    // If a safety classifier declines, retry server-side on the recommended model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  });

  if (response.stop_reason === "refusal") throw new Error("Request was declined");
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return opts.schema.parse(JSON.parse(text));
}

export function logAiError(step: string, error: unknown) {
  if (error instanceof AiNotConfiguredError) return;
  if (error instanceof Anthropic.APIError) {
    console.warn(`[ai] ${step} API error ${error.status}`, error.message);
  } else {
    console.warn(`[ai] ${step} failed`, (error as Error).message);
  }
}
