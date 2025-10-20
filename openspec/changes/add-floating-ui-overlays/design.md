# Floating UI Overlays Design

## Context

OpenShaderGraph currently implements all editor functionality as ReactFlow nodes (`editor_node` meta tag). This includes both graph-integrated nodes (probe, note) and pure UI panels (preview, compile, graphdata, assets, properties). Treating UI panels as graph nodes creates performance issues (recompilation on move/resize), UX friction (zoom affects readability, panels saved per-graph), and limits future flexibility (docking, anchoring).

## Goals / Non-Goals

### Goals

- Extract UI-only panels from the graph data model
- Enable freely movable/resizable overlays independent of canvas zoom/pan
- Persist overlay positions across different graphs (application-level state)
- Maintain visual consistency with existing shadcn-styled UI
- Support future docking/anchoring functionality (layout foundation only)
- Keep graph nodes (probe, note) functioning as ReactFlow nodes

### Non-Goals

- Full docking system implementation (defer to future work)
- Replacing ReactFlow for graph nodes
- Changing the graph data model structure (only exclude overlay nodes)
- Supporting overlays outside the editor region (constrained to canvas bounds for now)

## Decisions

### 1. Library: react-rnd for Drag/Resize

**Decision**: Use `react-rnd` for drag and resize functionality.

**Rationale**:

- Provides both dragging and resizing in a single, well-maintained library
- Simple API: `<Rnd position={...} size={...} onDragStop={...} onResizeStop={...}>`
- Supports bounds constraints (keep overlays within editor region)
- No dependency on ReactFlow (clean separation)

**Alternatives considered**:

- `dnd-kit`: More flexible but requires custom resize implementation; overkill for this use case
- `react-draggable` + custom resize: More control but more complexity; increases maintenance burden
- ReactFlow `NodeResizer`: Couples overlays to ReactFlow, defeats the purpose of extraction

### 2. State Management: Application-level Persistence

**Decision**: Store overlay state (position, size, visibility) in application state using localStorage.

**Rationale**:

- Overlays should persist across different graphs (e.g., preview stays open when switching files)
- Simple key-value storage: `overlays: { preview: { x, y, width, height, visible }, ... }`
- Aligns with existing patterns (settings, recent files)
- No graph data pollution

**Alternatives considered**:

- Per-graph storage: Defeats purpose; overlays should be consistent across graphs
- Zustand/Redux: Overkill for simple key-value state; adds dependency
- No persistence: Poor UX; users must reposition overlays every session

### 3. Architecture: Overlay Container Layer

**Decision**: Render overlays in a dedicated container above the ReactFlow canvas in `App.tsx`.

```tsx
<div className="relative h-full">
  <ReactFlow ... />
  <OverlayContainer>
    <PreviewOverlay />
    <CompileOverlay />
    <GraphDataOverlay />
    <AssetsOverlay />
    <PropertiesOverlay />
  </OverlayContainer>
</div>
```

**Rationale**:

- Clean separation: ReactFlow owns graph nodes, overlay container owns UI panels
- Proper z-ordering: overlays render above canvas using CSS `position: absolute`
- Easy to add/remove overlays without touching graph logic
- Future docking can replace/wrap `OverlayContainer`

**Alternatives considered**:

- Portals: Unnecessary complexity; overlays can render directly in tree
- ReactFlow's custom layers: Couples overlays to ReactFlow; limits flexibility

### 4. Node Definitions: Deprecate vs. Remove

**Decision**: Mark overlay node definitions (preview.json, compile.json, etc.) as deprecated but keep probe.json and note.json.

**Rationale**:

- Overlay nodes are no longer part of the graph model (removed from serialization)
- Legacy graphs may reference these nodes; deprecation prevents errors on load
- Probe and note remain as graph nodes; their definitions are still valid
- Node palette/context menu filters out deprecated overlay types

**Alternatives considered**:

- Remove definitions entirely: Breaks backward compatibility with existing graphs
- Keep as-is: Confusing; users can add overlay nodes to graphs (invalid state)

### 5. Graph Serialization: Filter Overlay Nodes

**Decision**: Exclude overlay-type editor nodes during graph serialization in `graphSerde.ts`.

**Rationale**:

- Graph data should only include shader logic nodes (including probe/note)
- Overlay state is application-level (localStorage), not graph-level
- Prevents legacy overlay nodes from being saved in new graphs
- Migration: existing graphs with overlay nodes will have them stripped on save

**Alternatives considered**:

- Separate serialization format: Adds complexity; overlays don't need graph-level storage
- Store overlay state in graph: Couples UI to data model; defeats purpose

### 6. Styling: shadcn Card + Tailwind

**Decision**: Wrap each overlay in shadcn `Card` component with consistent styling.

**Rationale**:

- Visual consistency with existing UI (panels, dialogs, etc.)
- Reuses theme tokens (colors, borders, shadows)
- Minimal custom CSS; leverages existing design system
- Easy to extend with shadcn components (buttons, inputs, etc.)

**Example**:

```tsx
<Rnd ...>
  <Card className="h-full flex flex-col shadow-lg">
    <CardHeader className="flex-none">
      <CardTitle>3D Preview</CardTitle>
    </CardHeader>
    <CardContent className="flex-1 overflow-auto">
      {/* PreviewPanel content */}
    </CardContent>
  </Card>
</Rnd>
```

### 7. Coordination: Centralized Overlay State

**Decision**: Create `src/core/ui/overlayState.ts` with React Context for overlay management.

**Rationale**:

- Centralized state: single source of truth for overlay visibility, position, size
- React Context provides easy access across components (toggle overlay from menu, render in container)
- Type-safe API: `useOverlay('preview')`, `toggleOverlay('preview')`, `updateOverlayBounds('preview', { x, y, width, height })`
- Encapsulates localStorage persistence logic

**Example API**:

```typescript
type OverlayId = "preview" | "compile" | "graphdata" | "assets" | "properties";
type OverlayState = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};

// Context value
interface OverlayContextValue {
  overlays: Record<OverlayId, OverlayState>;
  toggleOverlay: (id: OverlayId) => void;
  updateOverlayBounds: (id: OverlayId, bounds: Partial<OverlayState>) => void;
}
```

## Risks / Trade-offs

### Risk: Backward Compatibility

**Mitigation**: Legacy graphs with overlay nodes will gracefully degrade (nodes filtered out on load/save). Users may need to re-add overlay panels from the View menu on first load after upgrade.

### Risk: Z-ordering Conflicts

**Issue**: Multiple overlays may overlap; no built-in window management.

**Mitigation**:

- Default positions stagger overlays (preview top-right, compile below, etc.)
- Click-to-front behavior (update z-index on interaction)
- Defer full window management to future docking work

### Trade-off: Two Node Systems

**Issue**: Developers must understand graph nodes (ReactFlow) vs. overlays (react-rnd).

**Mitigation**:

- Clear separation: `data/nodes/*` are graph nodes; `src/components/overlays/*` are UI overlays
- Type system enforces distinction (overlay components don't use `NodeProps`)
- Documentation: openspec specs and code comments clarify categories

### Trade-off: Manual Layout

**Issue**: Users manually position overlays; no automatic layout.

**Mitigation**:

- Sensible defaults (preview top-right, etc.)
- Persist positions across sessions (localStorage)
- Future docking provides automatic layout options

## Migration Plan

### Phase 1: Infrastructure (this proposal)

1. Add `react-rnd` dependency
2. Create overlay state management (`overlayState.ts`, React Context)
3. Implement `FloatingOverlay` wrapper component
4. Build individual overlay components (preview, compile, etc.)
5. Update `App.tsx` to render overlay container
6. Filter overlay nodes in `reactFlowGraph.ts` and `graphSerde.ts`
7. Update node palette/menu to hide overlay node types
8. Tests: overlay state persistence, graph serialization exclusion

### Phase 2: User-Facing (immediate follow-up)

1. Add View menu to toggle overlays
2. Keyboard shortcuts (e.g., `Ctrl+Shift+P` for preview)
3. Visual indicators (close button, minimize/maximize)
4. Accessibility (focus management, keyboard navigation)

### Phase 3: Future Enhancements (not in scope)

1. Docking/anchoring system (snap to edges, tabs)
2. Workspace presets (save/load overlay layouts)
3. Multi-monitor support
4. Overlay groups (e.g., "Debug" preset with probe + compile)

### Rollback

If overlays cause critical issues:

1. Hide overlay container (CSS `display: none`)
2. Re-enable overlay nodes in graph (revert serialization filter)
3. Users can continue using legacy overlay nodes in ReactFlow

## Open Questions

1. **Default overlay positions**: Should we use viewport-relative (e.g., 10% from top-right) or absolute pixel coordinates?

   - **Recommendation**: Viewport-relative for responsive design; recalculate on window resize.

2. **Overlay bounds**: Should overlays be constrained to editor region or allow overflow?

   - **Recommendation**: Constrain to editor region for now; prevents overlays from covering menubar/sidebar.

3. **Probe/note classification**: Should probe remain as ReactFlow node or become overlay?

   - **Decision**: Probe has input pin → remains as graph node (per user requirements).

4. **Note behavior**: User wants note to remain as graph node despite having no pins.

   - **Decision**: Keep note as ReactFlow node (respects user intent; may have future use cases for note pins).

5. **Assets panel**: User mentioned docking to bottom (Unreal Engine style).
   - **Decision**: Implement as floating overlay for now; docking is Phase 3 enhancement.
