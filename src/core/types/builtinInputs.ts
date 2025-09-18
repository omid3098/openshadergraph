type BuiltinInputDescriptor = {
  key: string;
  label: string;
  type: string;
  expression: string;
  languageOverrides?: Record<string, string>;
};

const BUILTIN_PREFIX = "builtin:";

const BUILTIN_INPUTS: Record<string, BuiltinInputDescriptor> = {
  uv: {
    key: "uv",
    label: "UV",
    type: "float2",
    expression: "UV",
    languageOverrides: {
      "ThreeJS GLSL": "vUv",
    },
  },
};

export function isBuiltinToken(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(BUILTIN_PREFIX);
}

function getKeyFromToken(token: string): string {
  return token.slice(BUILTIN_PREFIX.length).toLowerCase();
}

function getDescriptor(token: string): BuiltinInputDescriptor {
  const key = getKeyFromToken(token);
  const descriptor = BUILTIN_INPUTS[key];
  if (!descriptor) {
    throw new Error(`Unknown builtin input '${key}'.`);
  }
  return descriptor;
}

export function getBuiltinDisplayLabel(token: string): string {
  const descriptor = getDescriptor(token);
  return descriptor.label;
}

export function getBuiltinPinType(token: string): string {
  const descriptor = getDescriptor(token);
  return descriptor.type;
}

export function resolveBuiltinExpression(token: string, languageName: string): string {
  const descriptor = getDescriptor(token);
  const overrides = descriptor.languageOverrides ?? {};
  return overrides[languageName] ?? descriptor.expression;
}

export function listBuiltinTokens(): string[] {
  return Object.keys(BUILTIN_INPUTS).map((key) => `${BUILTIN_PREFIX}${key}`);
}
