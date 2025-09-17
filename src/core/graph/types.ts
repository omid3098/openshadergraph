import type { LanguageNodeTemplate, LanguagePack, NodeProperty } from "../schema/types";

export type PinType = string | string[];

export type InputPin = {
  id: number;
  name: string;
  type: PinType;
  value: any;
  _ref_type?: string;
  _code?: string;
};

export type OutputPin = {
  id: number;
  name: string;
  type: PinType;
};

export type GraphNode = {
  id: number;
  type: string;
  name?: string;
  meta?: any[];
  position?: [number, number];
  nodes: GraphNode[];
  inputs: InputPin[];
  outputs: OutputPin[];
  properties?: NodeProperty[];
  parent?: GraphNode;
  _code?: string;
  _input_code?: string;
  _resolved_type?: string;
  _resolving_input?: boolean;
};

export type Graph = GraphNode; // root is also a node (e.g., surface)

export type { LanguageNodeTemplate, LanguagePack };
