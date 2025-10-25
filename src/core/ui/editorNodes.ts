import type { Node } from "@xyflow/react";

const EDITOR_BASE_X = 80;
const EDITOR_BASE_Y = 80;
const EDITOR_STEP_X = 48;
const EDITOR_STEP_Y = 48;
const EDITOR_MAX_PER_ROW = 4;

function getTemplateType(node: Node): string | undefined {
  const data: any = node.data ?? {};
  const tpl: any = data.template ?? {};
  return typeof tpl.type === "string" ? tpl.type : typeof data.type === "string" ? data.type : undefined;
}

function hasEditorMeta(node: Node): boolean {
  const meta: unknown = (node.data as any)?.template?.meta;
  if (!Array.isArray(meta)) return false;
  return meta.includes("editor_node");
}

export function isEditorNodeOfType(node: Node, templateType: string): boolean {
  if (!node || !templateType) return false;
  if (!hasEditorMeta(node)) return false;
  return getTemplateType(node) === templateType;
}

export function collectEditorNodes(nodes: Node[], templateType: string, parentId?: string): Node[] {
  const targetParent = parentId ?? undefined;
  return nodes.filter((node) => {
    if (!isEditorNodeOfType(node, templateType)) return false;
    const nodeParent = (node as any).parentId ?? undefined;
    return nodeParent === targetParent;
  });
}

function buildOccupiedMap(nodes: Node[], parentId?: string): Set<string> {
  const targetParent = parentId ?? undefined;
  const occupied = new Set<string>();
  for (const node of nodes) {
    const nodeParent = (node as any).parentId ?? undefined;
    if (nodeParent !== targetParent) continue;
    const position = node.position ?? { x: 0, y: 0 };
    const x = Number.isFinite(position.x) ? position.x : 0;
    const y = Number.isFinite(position.y) ? position.y : 0;
    occupied.add(`${Math.round(x)}:${Math.round(y)}`);
  }
  return occupied;
}

export function computeEditorSpawnPosition(nodes: Node[], parentId?: string): { x: number; y: number } {
  const occupied = buildOccupiedMap(nodes, parentId);
  for (let slot = 0; slot < 1000; slot++) {
    const row = Math.floor(slot / EDITOR_MAX_PER_ROW);
    const col = slot % EDITOR_MAX_PER_ROW;
    const x = EDITOR_BASE_X + col * EDITOR_STEP_X;
    const y = EDITOR_BASE_Y + row * EDITOR_STEP_Y;
    const key = `${Math.round(x)}:${Math.round(y)}`;
    if (!occupied.has(key)) {
      return { x, y };
    }
  }
  return { x: EDITOR_BASE_X, y: EDITOR_BASE_Y };
}

export const EDITOR_PANEL_TYPES = {
  properties: "editor_properties",
  compile: "editor_compile",
  graphdata: "editor_graph_data",
  preview: "editor_preview",
  assets: "editor_assets",
} as const;

export type EditorPanelKey = keyof typeof EDITOR_PANEL_TYPES;

const OVERLAY_PANEL_META_PREFIX = "editor_panel:";
const OVERLAY_PANEL_KEYS = new Set<EditorPanelKey>(Object.keys(EDITOR_PANEL_TYPES) as EditorPanelKey[]);
const OVERLAY_TEMPLATE_TYPES = new Set<string>(Object.values(EDITOR_PANEL_TYPES));

export function parseOverlayPanelMeta(token: string): EditorPanelKey | null {
  if (typeof token !== "string" || !token.startsWith(OVERLAY_PANEL_META_PREFIX)) return null;
  const key = token.slice(OVERLAY_PANEL_META_PREFIX.length).trim().toLowerCase() as EditorPanelKey;
  return OVERLAY_PANEL_KEYS.has(key) ? key : null;
}

export function isOverlayTemplateType(templateType: string | undefined | null): boolean {
  if (!templateType) return false;
  return OVERLAY_TEMPLATE_TYPES.has(templateType);
}

export function hasOverlayPanelMeta(meta: unknown): boolean {
  if (typeof meta === "string") return parseOverlayPanelMeta(meta) !== null;
  if (Array.isArray(meta)) {
    return meta.some((entry) => typeof entry === "string" && parseOverlayPanelMeta(entry) !== null);
  }
  return false;
}

export function isOverlayEditorNode(candidate: { type?: string; meta?: unknown }): boolean {
  const type = typeof candidate.type === "string" ? candidate.type : undefined;
  const meta = Array.isArray(candidate.meta) ? candidate.meta : undefined;
  return isOverlayTemplateType(type) || hasOverlayPanelMeta(meta);
}
