# Add Floating UI Overlays

## Why

UI panels (preview, compile, graph data, assets, and properties) were originally right-side panels accessible via the View menu. Due to implementation inconsistencies, they were temporarily converted to ReactFlow "editor nodes" that participate in the graph layout. This causes performance and UX issues: moving or resizing these UI panels triggers graph recompilation, zoom affects their sizing and readability, and they are incorrectly serialized with graph data despite being UI-only concerns. These panels should return to being pure UI elements (not nodes), but as persistent, freely movable overlays instead of fixed side panels, similar to docked panels in modern IDEs like Unreal Engine or VS Code.

## What Changes

- **NEW**: Floating UI overlay system for View menu panels (preview, compile, graphdata, assets, properties)
  - Overlays render above the ReactFlow canvas using `react-rnd` for drag/resize
  - Styled with shadcn components (Card, buttons, etc.) for visual consistency
  - Positions/sizes stored in application state (localStorage), not graph data
  - Not affected by canvas zoom/pan
  - Persistent across different graphs
  - Accessible via View menu (restored from original implementation, improved with floating behavior)
- **REMOVED**: Preview, compile, graphdata, assets, and properties as "editor nodes"
  - These were never meant to be nodes; temporary workaround is removed
  - Node definitions (preview.json, compile.json, etc.) deprecated
  - No longer appear in node palette or context menu
  - Filtered from graph serialization and ReactFlow graph build
- **UNCHANGED**: Actual editor nodes (probe, note) remain as ReactFlow nodes
  - Probe and note are true graph nodes with semantic meaning
  - Continue to behave like other default shader nodes
- Future-ready: architecture supports docking/anchoring (e.g., content browser at bottom) in later iterations

## Impact

### Affected Specs

- `floating-ui-overlays` (new capability - restores View menu panels as floating overlays)
- `editor-nodes` (modified - remove non-node UI panels, clarify probe/note remain as true nodes)
- `graph-serialization` (modified - filter out legacy UI panel nodes on load)

### Affected Code

- `src/components/GraphNode.tsx` - remove UI panel rendering logic (preview, compile, graphdata, assets, properties)
- `src/App.tsx` - add overlay container, manage overlay state, restore View menu integration
- `src/core/ui/reactFlowGraph.ts` - filter out legacy UI panel nodes during graph build
- `src/core/ui/graphSerde.ts` - filter out legacy UI panel nodes from serialization
- `src/core/ui/nodeFactory.ts` - remove UI panel node creation logic
- `data/nodes/editor/preview.json`, `compile.json`, `graphdata.json`, `assets.json`, `properties.json` - mark as deprecated
- `data/nodes/editor/probe.json`, `note.json` - unchanged (remain as true editor nodes)
- New files:
  - `src/components/FloatingOverlay.tsx` - drag/resize wrapper for View menu panels
  - `src/components/overlays/*.tsx` - individual overlay components (previously were right-side panels)
  - `src/core/ui/overlayState.ts` - state management and persistence for View menu panels

### Performance Benefits

- UI panels (preview, compile, etc.) no longer trigger graph recompilation on move/resize
- Reduced ReactFlow node count improves rendering performance (UI panels removed from graph)
- Graph serialization payload is smaller (UI panels not included)
- Cleaner separation: graph operations only affect actual shader nodes

### UX Benefits

- UI panels accessible via View menu (original intent restored)
- Overlays maintain consistent size/position regardless of canvas zoom
- Panels persist across different graphs (e.g., preview stays open when switching files)
- Improved over original right-side panels: freely movable/resizable instead of fixed docking
- Future docking/anchoring support for flexible layouts (can return to fixed panels if desired)
