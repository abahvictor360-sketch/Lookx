import "server-only";

import { z } from "zod";
import type { AuthenticitySection, Likelihood } from "@/lib/lookup/image/types";
import { AiNotConfiguredError, callClaudeJson, logAiError } from "./client";

const TIMEOUT_MS = 12_000;

/**
 * Vision check of the image itself. Strictly about the IMAGE, never about who
 * is in it. Kept constant so it can be prompt-cached.
 */
const SYSTEM_PROMPT = `You assess images for LookX, a "verify before you trust" tool. Users upload photos from online vendors, dating profiles and social media to check whether the photo is genuine.

Assess only the image as an artifact:
- ai_generated: signs the image was created by an AI image generator (texture artifacts, malformed hands/text, inconsistent lighting or reflections, overly smooth skin or backgrounds).
- edited: signs of editing or manipulation beyond normal filters (cloning, warped backgrounds, pasted elements, inconsistent edges or shadows).
- stock_or_catalog: whether it looks like a professional stock photo, model shoot, or product catalog/brand image rather than a casual personal or seller photo.
- visible_text: watermarks, usernames, handles, logos or website names visible in the image, exactly as written. Do not include any other text.

Strict rules:
- Never identify, name, or guess who any person in the image is, and never say they resemble anyone.
- Never comment on a person's age, ethnicity, religion, health, attractiveness, relationship status or other personal traits.
- Each note is one short factual sentence about visual evidence. If unsure, use "unknown" or "low".`;

const Level = z.enum(["low", "medium", "high", "unknown"]);
const Schema = z.object({
  ai_generated: z.object({ level: Level, note: z.string() }),
  edited: z.object({ level: Level, note: z.string() }),
  stock_or_catalog: z.object({ level: Level, note: z.string() }),
  visible_text: z.array(z.string()),
});

const levelJson = {
  type: "object",
  properties: { level: { type: "string", enum: ["low", "medium", "high", "unknown"] }, note: { type: "string" } },
  required: ["level", "note"],
  additionalProperties: false,
};
const JSON_SCHEMA = {
  type: "object",
  properties: {
    ai_generated: levelJson,
    edited: levelJson,
    stock_or_catalog: levelJson,
    visible_text: { type: "array", items: { type: "string" } },
  },
  required: ["ai_generated", "edited", "stock_or_catalog", "visible_text"],
  additionalProperties: false,
};

const unknown = (note: string) => ({ level: "unknown" as Likelihood, note });

export async function analyzeImage(jpeg: Buffer, metadataSoftware: string | null): Promise<AuthenticitySection> {
  try {
    const r = await callClaudeJson({
      system: SYSTEM_PROMPT,
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } },
        {
          type: "text",
          text: `Editing software recorded in the file's metadata: ${metadataSoftware ?? "none"}.\nReturn the JSON assessment.`,
        },
      ],
      schema: Schema,
      jsonSchema: JSON_SCHEMA,
      timeoutMs: TIMEOUT_MS,
      effort: "low",
    });
    return {
      status: "ok",
      aiGenerated: { level: r.ai_generated.level, note: r.ai_generated.note.slice(0, 240) },
      edited: { level: r.edited.level, note: r.edited.note.slice(0, 240) },
      stockOrCatalog: { level: r.stock_or_catalog.level, note: r.stock_or_catalog.note.slice(0, 240) },
      visibleText: r.visible_text.map((t) => t.slice(0, 80)).slice(0, 8),
    };
  } catch (error) {
    logAiError("image analysis", error);
    const msg = error instanceof AiNotConfiguredError ? "Automatic image analysis isn't available." : "Image analysis didn't complete.";
    return {
      status: error instanceof AiNotConfiguredError ? "not_configured" : "error",
      aiGenerated: unknown(msg),
      edited: unknown(msg),
      stockOrCatalog: unknown(msg),
      visibleText: [],
    };
  }
}
