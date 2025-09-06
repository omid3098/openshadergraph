import { z } from "zod";
import type { LanguagePack, NodeTemplate } from "./types";

export const ZNodeTemplate: z.ZodSchema<NodeTemplate> = z.object({
  id: z.number().int().optional(),
  type: z.string().min(1),
  name: z.string().optional(),
  meta: z.array(z.any()).optional(),
  position: z.tuple([z.number(), z.number()]).optional(),
  nodes: z
    .array(
      z.object({
        id: z.number().int().optional(),
        type: z.string().min(1),
      })
    )
    .optional(),
  inputs: z
    .array(
      z.object({
        id: z.number().int().optional(),
        name: z.string().min(1),
        type: z.any(), // allow string|string[] or nested types; refined later by compiler
        value: z.any().optional(),
      })
    )
    .optional(),
  outputs: z
    .array(
      z.object({
        id: z.number().int().optional(),
        name: z.string().min(1),
        type: z.any(),
      })
    )
    .optional(),
});

export const ZLanguagePack: z.ZodSchema<LanguagePack> = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  file_extensions: z.array(z.string()).min(1),
  nodes: z.record(z.object({ template: z.string().min(1) })),
  meta: z.record(z.object({ template: z.string() })).optional(),
});

export function validateNodeTemplate(obj: unknown): NodeTemplate {
  const parsed = ZNodeTemplate.safeParse(obj);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid node template: ${msg}`);
  }
  return parsed.data;
}

export function validateLanguagePack(obj: unknown): LanguagePack {
  const parsed = ZLanguagePack.safeParse(obj);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid language pack: ${msg}`);
  }
  return parsed.data;
}
