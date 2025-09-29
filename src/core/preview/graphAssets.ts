export type SamplerPreviewSettings = {
  wrap?: string;
  filter?: string;
};

const REF_RE = /^\.\.\/(\d+)\/(\d+)$/;

export function collectTextureUniforms(graph: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const stack: any[] = [];
  if (graph && typeof graph === "object") stack.push(graph);
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    const type = (node as any).type;
    if (type === "texture" || type === "texture_cube" || type === "texture3d" || type === "texture_array") {
      const id = Number((node as any).id);
      if (Number.isFinite(id)) {
        const props = Array.isArray((node as any).properties) ? (node as any).properties : [];
        const sourceProp = props.find((p: any) => p?.id === "source" || p?.id === "texture_source");
        let source = typeof sourceProp?.value === "string" ? sourceProp.value : undefined;
        if (!source) {
          const meta = Array.isArray((node as any).meta) ? (node as any).meta : [];
          const assetMeta = meta.find((m: any) => typeof m === "string" && m.startsWith("asset:"));
          if (assetMeta) source = assetMeta.slice("asset:".length).trim();
        }
        if (source) {
          const prefix = type === "texture_cube" ? "texture_cube" : type === "texture3d" ? "texture3d" : type === "texture_array" ? "texture_array" : "texture";
          map.set(`${prefix}_${id}`, source);
        }
      }
    }
    if (Array.isArray((node as any).nodes)) {
      for (const child of (node as any).nodes) stack.push(child);
    }
  }
  return map;
}

export function collectSamplerSettings(graph: unknown): Map<string, SamplerPreviewSettings> {
  const settings = new Map<string, SamplerPreviewSettings>();
  const nodesById = new Map<number, any>();

  const walk = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const id = Number(value.id);
    if (Number.isFinite(id)) nodesById.set(id, value);
    if (Array.isArray(value.nodes)) {
      for (const child of value.nodes) walk(child);
    }
  };
  walk(graph);

  for (const node of nodesById.values()) {
    if (!node) continue;
    const samplerType = node.type;
    const samplerKind = samplerType === "texture_sampler_cube"
      ? "texture_cube"
      : samplerType === "texture_sampler3d"
        ? "texture3d"
        : samplerType === "texture_sampler_array"
          ? "texture_array"
          : samplerType === "texture_sampler"
            ? "texture"
            : null;
    if (!samplerKind) continue;
    const props: any[] = Array.isArray(node.properties) ? node.properties : [];
    const wrapProp = props.find((p) => p?.id === "wrap_mode");
    const filterProp = props.find((p) => p?.id === "filter_mode");
    const textureInput = (node.inputs ?? []).find((pin: any) => typeof pin?.value === "string" && REF_RE.test(pin.value));
    if (!textureInput) continue;
    const match = String(textureInput.value).match(REF_RE);
    if (!match) continue;
    const textureId = Number(match[1]);
    if (!Number.isFinite(textureId)) continue;
    const uniform = `${samplerKind}_${textureId}`;
    const entry: SamplerPreviewSettings = settings.get(uniform) ?? {};
    if (samplerKind !== "texture_cube" && wrapProp && typeof wrapProp.value === "string") entry.wrap = wrapProp.value;
    if (filterProp && typeof filterProp.value === "string") entry.filter = filterProp.value;
    settings.set(uniform, entry);
  }

  return settings;
}

export function applySamplerSettings(three: any, texture: any, settings?: SamplerPreviewSettings) {
  if (!settings || !three) return;
  const wrapKey = settings.wrap ?? "";
  let wrap = three.ClampToEdgeWrapping;
  if (wrapKey === "repeat") wrap = three.RepeatWrapping;
  else if (wrapKey === "mirror") wrap = three.MirroredRepeatWrapping;
  else if (wrapKey === "clamp") wrap = three.ClampToEdgeWrapping;
  else if (wrapKey === "border") wrap = three.ClampToEdgeWrapping;
  texture.wrapS = wrap;
  texture.wrapT = wrap;
  if ("wrapR" in texture) texture.wrapR = wrap;

  const filterKey = settings.filter ?? "";
  if (filterKey === "nearest") {
    texture.magFilter = three.NearestFilter;
    texture.minFilter = three.NearestMipmapNearestFilter;
    texture.generateMipmaps = true;
  } else if (filterKey === "cubic") {
    texture.magFilter = three.LinearFilter;
    texture.minFilter = three.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
  } else {
    texture.magFilter = three.LinearFilter;
    texture.minFilter = three.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
  }
  texture.needsUpdate = true;
}

export function cloneTextureForUniform(three: any, base: any, settings?: SamplerPreviewSettings): any {
  const tex = base.clone();
  tex.image = base.image;
  tex.needsUpdate = true;
  tex.colorSpace = base.colorSpace;
  tex.flipY = base.flipY;
  tex.anisotropy = base.anisotropy;
  applySamplerSettings(three, tex, settings);
  return tex;
}
