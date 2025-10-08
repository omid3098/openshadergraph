// Canonical schema types used across core and server

export type NodePropertyScalar = string | number | boolean;

export type NodePropertyOption = {
  value: string;
  label?: string;
  description?: string;
  /**
   * Optional language token used to look up implementation templates. The
   * language pack falls back to the raw option value when omitted.
   */
  langKey?: string;
};

export type NodePropertyBase<TType extends string, TValue> = {
  id: string;
  label: string;
  description?: string;
  type: TType;
  default?: TValue;
  required?: boolean;
  value?: TValue;
};

export type NodeEnumProperty = NodePropertyBase<"enum", string> & {
  options: NodePropertyOption[];
};

export type NodeNumberProperty = NodePropertyBase<"number", number> & {
  min?: number;
  max?: number;
  step?: number;
};

export type NodeBooleanProperty = NodePropertyBase<"boolean", boolean>;

export type NodeStringProperty = NodePropertyBase<"string", string> & {
  multiline?: boolean;
};

export type NodeAssetProperty = NodePropertyBase<"asset", string> & {
  assetKind?: AssetKind;
};

export type NodeProperty =
  | NodeEnumProperty
  | NodeNumberProperty
  | NodeBooleanProperty
  | NodeStringProperty
  | NodeAssetProperty;

export type NodePaletteItem = {
  type: string;
  name: string;
  path: string; // relative to data/nodes
  category: string; // folder name or 'root'
};

export type NodePalette = {
  categories: Array<{ name: string; nodes: NodePaletteItem[] }>;
  flat: NodePaletteItem[];
};

// Minimal template shape stored on disk and passed through UI
export type NodeTemplate = {
  id?: number;
  type: string;
  name?: string;
  meta?: any[];
  position?: [number, number];
  nodes?: Array<{ id?: number; type: string }>;
  inputs?: Array<{ id?: number; name: string; type: any; value?: any }>;
  outputs?: Array<{ id?: number; name: string; type: any }>;
  properties?: NodeProperty[];
};

export type LanguagePropertyVariant = {
  template: string;
  placement?: "inline" | "meta";
};

export type LanguageNodeTemplate = {
  template: string;
  properties?: Record<string, Record<string, LanguagePropertyVariant>>;
  outputs?: Record<string, string>;
};

export type LanguagePack = {
  name: string;
  version: string;
  file_extensions: string[];
  types?: Record<string, { code: string; ctor?: string; zero?: string; components?: number }>;
  capabilities?: {
    allowRgbSwizzle?: boolean;
    vectorCtorScalarSplat?: boolean;
  };
  nodes: Record<string, LanguageNodeTemplate>;
  coordinates?: {
    up: "x" | "+x" | "-x" | "y" | "+y" | "-y" | "z" | "+z" | "-z";
    right: "x" | "+x" | "-x" | "y" | "+y" | "-y" | "z" | "+z" | "-z";
    forward: "x" | "+x" | "-x" | "y" | "+y" | "-y" | "z" | "+z" | "-z";
    handedness?: "right" | "left";
  };
  meta?: Record<string, { template: string }>;
};

export type AssetKind = "texture" | "model" | string;

export type AssetProviderMeta = {
  id: string;
  name: string;
  assetId?: string;
  assetUrl?: string;
};

export type AssetItem = {
  id: string;
  label: string;
  type: AssetKind;
  source: string;
  description?: string;
  tags?: string[];
  builtin?: boolean;
  preview?: string;
  provider?: AssetProviderMeta;
};

export type AssetCategory = {
  id: string;
  label: string;
  items: AssetItem[];
};

export type AssetLibrary = {
  version: number;
  categories: AssetCategory[];
};
