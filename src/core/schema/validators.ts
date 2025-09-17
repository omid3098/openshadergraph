import { z } from "zod";
import type { AssetLibrary, LanguagePack, NodeTemplate } from "./types";

const ZNodePropertyOption = z.object({
  value: z.string().min(1),
  label: z.string().optional(),
  description: z.string().optional(),
  langKey: z.string().optional(),
});

const ZNodePropertyBase = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

const ZEnumProperty = ZNodePropertyBase.extend({
  type: z.literal("enum"),
  options: z.array(ZNodePropertyOption).min(1),
  default: z.string().optional(),
  value: z.string().optional(),
}).superRefine((prop, ctx) => {
  const allowed = new Set(prop.options.map((opt) => opt.value));
  if (prop.default && !allowed.has(prop.default)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Default '${prop.default}' not in enum options for property '${prop.id}'`,
    });
  }
  if (prop.value && !allowed.has(prop.value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Value '${prop.value}' not in enum options for property '${prop.id}'`,
    });
  }
});

const ZNumberProperty = ZNodePropertyBase.extend({
  type: z.literal("number"),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  default: z.number().optional(),
  value: z.number().optional(),
}).superRefine((prop, ctx) => {
  const check = (val: number | undefined, kind: "default" | "value") => {
    if (val === undefined) return;
    if (prop.min !== undefined && val < prop.min) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${kind} below minimum for property '${prop.id}'` });
    }
    if (prop.max !== undefined && val > prop.max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${kind} above maximum for property '${prop.id}'` });
    }
  };
  check(prop.default, "default");
  check(prop.value, "value");
});

const ZBooleanProperty = ZNodePropertyBase.extend({
  type: z.literal("boolean"),
  default: z.boolean().optional(),
  value: z.boolean().optional(),
});

const ZStringProperty = ZNodePropertyBase.extend({
  type: z.literal("string"),
  multiline: z.boolean().optional(),
  default: z.string().optional(),
  value: z.string().optional(),
});

const ZAssetProperty = ZNodePropertyBase.extend({
  type: z.literal("asset"),
  assetKind: z.string().optional(),
  default: z.string().optional(),
  value: z.string().optional(),
});

const ZNodeProperty = z.union([
  ZEnumProperty,
  ZNumberProperty,
  ZBooleanProperty,
  ZStringProperty,
  ZAssetProperty,
]);

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
  properties: z.array(ZNodeProperty).optional(),
});

const ZLanguageNodeTemplate = z.object({
  template: z.string().min(1),
  properties: z.record(z.record(z.object({ template: z.string() }))).optional(),
});

export const ZLanguagePack: z.ZodSchema<LanguagePack> = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  file_extensions: z.array(z.string()).min(1),
  nodes: z.record(ZLanguageNodeTemplate),
  meta: z.record(z.object({ template: z.string() })).optional(),
});

const ZAssetItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.string().min(1),
  source: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  builtin: z.boolean().optional(),
});

const ZAssetCategory = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  items: z.array(ZAssetItem).default([]),
});

export const ZAssetLibrary: z.ZodSchema<AssetLibrary> = z.object({
  version: z.number().int().nonnegative(),
  categories: z.array(ZAssetCategory).default([]),
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

export function validateAssetLibrary(obj: unknown): AssetLibrary {
  const parsed = ZAssetLibrary.safeParse(obj);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid asset library: ${msg}`);
  }
  return parsed.data;
}
