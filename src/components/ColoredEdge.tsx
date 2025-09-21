import * as React from "react";
import type { EdgeProps } from "@xyflow/react";
import { getBezierPath } from "@xyflow/react";
import { normalizePinType, type NormalizedPinType } from "@/core/ui/compat";
import { THEME } from "@/styles/theme";

function mapNormalizedToThemeKey(t: NormalizedPinType): keyof typeof THEME.pinColors {
  if (t === "float") return "scalar";
  if (t === "float2") return "vec2";
  if (t === "float3") return "vec3";
  if (t === "float4") return "vec4";
  if (t === "sampler2d") return "texture2D";
  if (t === "sampler3d") return "texture3D" as any;
  if (t === "samplercube") return "textureCube";
  if (t === "sampler") return "sampler";
  if (t === "int") return "int";
  if (t === "bool") return "bool";
  if (t === "mat3") return "mat3";
  if (t === "mat4") return "mat4";
  return "scalar";
}

function getPinTypeFromNode(node: any, handleId: string | null | undefined, dir: "in" | "out"): NormalizedPinType {
  if (!node || !handleId) return "unknown";
  const tpl = (node?.data as any)?.template;
  if (!tpl) return "unknown";
  const m = String(handleId).match(/^(in|input|out|output)-(\d+)$/);
  if (!m) return "unknown";
  const pid = Number(m[2]);
  const pins: any[] = Array.isArray(dir === "in" ? tpl?.inputs : tpl?.outputs) ? (dir === "in" ? tpl.inputs : tpl.outputs) : [];
  let found: any | undefined;
  for (let i = 0; i < pins.length; i++) {
    const p = pins[i];
    if (!p || typeof p !== "object") continue;
    const idVal = typeof p.id === "number" ? p.id : i;
    if (idVal === pid) { found = p; break; }
  }
  return normalizePinType(found?.type);
}

export default function ColoredEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, sourceNode, targetNode, sourceHandle, targetHandle, selected } = props as any;
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const sourceType = getPinTypeFromNode(sourceNode, sourceHandle, "out");
  const targetType = getPinTypeFromNode(targetNode, targetHandle, "in");
  const sourceKey = mapNormalizedToThemeKey(sourceType);
  const targetKey = mapNormalizedToThemeKey(targetType);
  const colorStart = THEME.pinColors[sourceKey] ?? THEME.selectionColor;
  const colorEnd = THEME.pinColors[targetKey] ?? THEME.selectionColor;
  const gradientId = `edge-gradient-${id}`;

  const strokeWidth = selected ? 3.5 : 3;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0%" stopColor={colorStart} />
          <stop offset="100%" stopColor={colorEnd} />
        </linearGradient>
      </defs>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        style={style}
        markerEnd={markerEnd}
      />
    </g>
  );
}


