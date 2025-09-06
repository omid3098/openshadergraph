// Canonical schema types used across core and server

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
};

export type LanguageNodeTemplate = { template: string };

export type LanguagePack = {
  name: string;
  version: string;
  file_extensions: string[];
  nodes: Record<string, LanguageNodeTemplate>;
  meta?: Record<string, { template: string }>;
};

