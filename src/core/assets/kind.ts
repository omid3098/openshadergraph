export const TEXTURE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "ktx", "ktx2", "bmp", "tga", "gif", "hdr"] as const;
export const MODEL_EXTENSIONS = ["glb", "gltf", "obj", "fbx", "dae", "ply"] as const;

export const ASSET_DRAG_MIME = "application/x-openshadergraph-asset";

export type TextureExtension = (typeof TEXTURE_EXTENSIONS)[number];
export type ModelExtension = (typeof MODEL_EXTENSIONS)[number];

export type AssetDragData = {
  id: string;
  label: string;
  type: "texture" | "model" | string;
  source: string;
  builtin?: boolean;
};

/**
 * Infer whether a filename corresponds to a texture or model asset based on its extension.
 * Returns null when the extension is unsupported.
 */
export function inferAssetKind(filename: string): "texture" | "model" | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ext) return null;
  if (TEXTURE_EXTENSIONS.includes(ext as TextureExtension)) return "texture";
  if (MODEL_EXTENSIONS.includes(ext as ModelExtension)) return "model";
  return null;
}

export function parseAssetDragPayload(raw: string | null | undefined): AssetDragData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { id, label, type, source, builtin } = parsed as Record<string, unknown>;
    if (typeof id !== "string" || typeof label !== "string" || typeof type !== "string" || typeof source !== "string") {
      return null;
    }
    return { id, label, type, source, builtin: typeof builtin === "boolean" ? builtin : undefined };
  } catch {
    return null;
  }
}
