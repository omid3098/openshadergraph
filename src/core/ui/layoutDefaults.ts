// Shared layout defaults for positioning core graph nodes.
// Keeping these centrally defined helps align UI expectations across the app and tests.

export type XYTuple = [number, number];

export const RF_LAYOUT_DEFAULTS = Object.freeze({
  baseX: 80,
  baseY: 40,
  depthX: 240,
  rowY: 120,
});

export const DEFAULT_PASS_HORIZONTAL_GAP = 120;
export const DEFAULT_PREVIEW_OFFSET_X = 170;

export type DefaultPassLayout = {
  vertexPass: XYTuple;
  vertexOutput: XYTuple;
  fragmentPass: XYTuple;
  fragmentOutput: XYTuple;
  preview: XYTuple;
};

export function computeDefaultPassLayout(): DefaultPassLayout {
  const vertexPassX = RF_LAYOUT_DEFAULTS.baseX + RF_LAYOUT_DEFAULTS.depthX;
  const vertexY = RF_LAYOUT_DEFAULTS.baseY;

  const vertexOutputX = vertexPassX + RF_LAYOUT_DEFAULTS.depthX;
  const fragmentPassX = vertexOutputX + DEFAULT_PASS_HORIZONTAL_GAP;
  const fragmentOutputX = fragmentPassX + RF_LAYOUT_DEFAULTS.depthX;
  const previewX = fragmentOutputX + DEFAULT_PREVIEW_OFFSET_X;

  return {
    vertexPass: [vertexPassX, vertexY],
    vertexOutput: [vertexOutputX, vertexY],
    fragmentPass: [fragmentPassX, vertexY],
    fragmentOutput: [fragmentOutputX, vertexY],
    preview: [previewX, vertexY],
  };
}
