import type { Node } from "@xyflow/react";

type InputValue = number[] | string | number;

export type NodeAssetPayload = {
  id: string;
  source: string;
  type?: string;
  label?: string;
  builtin?: boolean;
};

export type NodeUpdaterApi = {
  updateInputValue: (id: string, pinId: number, next: InputValue) => void;
  updatePropertyValue: (id: string, propId: string, next: unknown) => void;
  updateNodeLabel: (id: string, label: string) => void;
  addNodeMeta: (id: string, metaKey: string) => void;
  removeNodeMeta: (id: string, metaKey: string) => void;
  updateNodeAsset: (id: string, asset: NodeAssetPayload | null) => void;
};

export function attachNodeUpdateApi<T extends Node>(node: T, api: NodeUpdaterApi): T {
  const baseData = (node?.data ?? {}) as Record<string, unknown>;
  return {
    ...node,
    data: {
      ...baseData,
      updateInputValue: api.updateInputValue,
      updatePropertyValue: api.updatePropertyValue,
      updateNodeLabel: api.updateNodeLabel,
      addNodeMeta: api.addNodeMeta,
      removeNodeMeta: api.removeNodeMeta,
      updateNodeAsset: api.updateNodeAsset,
    },
  };
}

export function attachNodesUpdateApi<T extends Node>(nodes: T[], api: NodeUpdaterApi): T[] {
  return nodes.map((node) => attachNodeUpdateApi(node, api));
}
