import rawProfiles from "../../../data/preview/lighting_profiles.json";

export type LightingProfileLight = {
  type: string;
  position?: [number, number, number];
  direction?: [number, number, number];
  color: [number, number, number];
  intensity: number;
};

export type LightingProfile = {
  id: string;
  label: string;
  description: string;
  exposure: number;
  ambient: [number, number, number];
  lights: LightingProfileLight[];
};

function toVector3(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const [x, y, z] = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return undefined;
  return [x, y, z];
}

function sanitizeLight(light: any): LightingProfileLight | null {
  if (!light || typeof light !== "object") return null;
  const type = typeof light.type === "string" ? light.type : "directional";
  const position = toVector3(light.position);
  const direction = toVector3(light.direction);
  const color = toVector3(light.color) ?? [1, 1, 1];
  const intensity = typeof light.intensity === "number" && Number.isFinite(light.intensity) ? light.intensity : 1;
  return { type, position, direction, color, intensity };
}

function sanitizeProfile(profile: any): LightingProfile | null {
  if (!profile || typeof profile !== "object") return null;
  const id = typeof profile.id === "string" && profile.id ? profile.id : null;
  const label = typeof profile.label === "string" && profile.label ? profile.label : id;
  if (!id || !label) return null;
  const description = typeof profile.description === "string" ? profile.description : "";
  const exposure = typeof profile.exposure === "number" && Number.isFinite(profile.exposure) ? profile.exposure : 1;
  const ambient = toVector3(profile.ambient) ?? [0.05, 0.05, 0.05];
  const lightsRaw = Array.isArray(profile.lights) ? profile.lights : [];
  const lights: LightingProfileLight[] = [];
  for (const light of lightsRaw) {
    const sanitized = sanitizeLight(light);
    if (sanitized) lights.push(sanitized);
  }
  return { id, label, description, exposure, ambient, lights };
}

const parsedProfiles = Array.isArray(rawProfiles) ? rawProfiles.map(sanitizeProfile).filter(Boolean) : [];

if (!parsedProfiles.length) {
  parsedProfiles.push({
    id: "default",
    label: "Default",
    description: "Fallback preview lighting.",
    exposure: 1.3,
    ambient: [0.08, 0.08, 0.08],
    lights: [
      { type: "directional", direction: [-0.35, 0.8, 0.6], color: [1, 1, 1], intensity: 3 },
      { type: "directional", direction: [0.6, 0.2, 0.2], color: [0.8, 0.9, 1], intensity: 1.2 },
      { type: "directional", direction: [-0.2, 0.3, -0.9], color: [1, 0.9, 1.1], intensity: 2 },
    ],
  });
}

export const lightingProfiles: LightingProfile[] = parsedProfiles as LightingProfile[];

export const DEFAULT_LIGHTING_PROFILE_ID = lightingProfiles[0]?.id ?? "default";

export function getLightingProfile(id: string | null | undefined): LightingProfile {
  if (id) {
    const match = lightingProfiles.find((profile) => profile.id === id);
    if (match) return match;
  }
  return lightingProfiles[0];
}
