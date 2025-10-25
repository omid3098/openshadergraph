# Implementation Tasks

## 1. Dependencies and Setup

- [ ] 1.1 Add `react-rnd` to package.json and run `bun install`
- [ ] 1.2 Verify `react-rnd` TypeScript types are available

## 2. Overlay State Management

- [ ] 2.1 Create `src/core/ui/overlayState.ts` with OverlayState type definitions
- [ ] 2.2 Implement OverlayContext with React Context API
- [ ] 2.3 Add localStorage persistence for overlay state (position, size, visibility, zIndex)
- [ ] 2.4 Implement `useOverlay(id)` hook for accessing overlay state
- [ ] 2.5 Implement `toggleOverlay(id)`, `updateOverlayBounds(id, bounds)`, and `bringToFront(id)` functions
- [ ] 2.6 Add default overlay positions/sizes for first run
- [ ] 2.7 Write unit tests for overlay state management (`overlayState.test.ts`)

## 3. Floating Overlay Components

- [ ] 3.1 Create `src/components/FloatingOverlay.tsx` wrapper component using `react-rnd`
- [ ] 3.2 Wrap overlay content in shadcn Card with CardHeader and CardContent
- [ ] 3.3 Add close button to CardHeader that calls `toggleOverlay(id)`
- [ ] 3.4 Implement click-to-front behavior (update zIndex on mousedown)
- [ ] 3.5 Configure bounds constraint to keep overlays within editor region
- [ ] 3.6 Add drag handle styling to CardHeader (cursor: move)
- [ ] 3.7 Test FloatingOverlay drag and resize behavior manually

## 4. Individual Overlay Components

- [ ] 4.1 Create `src/components/overlays/PreviewOverlay.tsx` wrapping PreviewPanel
- [ ] 4.2 Create `src/components/overlays/CompileOverlay.tsx` wrapping CompilePanel
- [ ] 4.3 Create `src/components/overlays/GraphDataOverlay.tsx` wrapping GraphDataPanel
- [ ] 4.4 Create `src/components/overlays/AssetsOverlay.tsx` wrapping AssetsPanel
- [ ] 4.5 Create `src/components/overlays/PropertiesOverlay.tsx` wrapping PropertiesPanel
- [ ] 4.6 Ensure each overlay uses `useOverlay(id)` to read state and connect updaters
- [ ] 4.7 Pass graph/nodeUpdaterApi props from App to overlays as needed

## 5. Overlay Container in App

- [ ] 5.1 Wrap OverlayContext.Provider around App root in `src/App.tsx`
- [ ] 5.2 Create overlay container div with `position: absolute`, full editor region coverage, pointer-events: none
- [ ] 5.3 Set `pointer-events: auto` on individual overlays
- [ ] 5.4 Render all five overlay components conditionally based on visibility state
- [ ] 5.5 Ensure overlay container renders above ReactFlow canvas (z-index)
- [ ] 5.6 Test that canvas interactions (pan, zoom, select) work when overlays are hidden

## 6. Graph Serialization Updates

- [ ] 6.1 Update `src/core/ui/graphSerde.ts` to filter out overlay-type editor nodes during serialization
- [ ] 6.2 Add helper function `isOverlayNode(node)` to check for `editor_panel:preview|compile|graphdata|assets|properties`
- [ ] 6.3 Update `src/core/ui/reactFlowGraph.ts` to filter overlay nodes during graph build
- [ ] 6.4 Write unit tests for serialization exclusion (`graphSerde.test.ts`)
- [ ] 6.5 Write integration test: load legacy graph with overlay nodes, verify they're filtered
- [ ] 6.6 Write integration test: save graph with probe/note, verify they're included

## 7. Node Palette and Context Menu

- [ ] 7.1 Update `src/components/GraphContextMenu.tsx` to hide overlay node types (preview, compile, etc.)
- [ ] 7.2 Keep probe and note visible in node palette
- [ ] 7.3 Add "View" submenu to context menu (or separate View menu in menubar)
- [ ] 7.4 Add toggle options for each overlay (Preview, Compile, Graph Data, Assets, Properties)
- [ ] 7.5 Wire toggle options to call `toggleOverlay(id)`

## 8. Keyboard Shortcuts (Optional, can defer to Phase 2)

- [ ] 8.1 Add keyboard shortcut for preview toggle (e.g., Ctrl+Shift+P)
- [ ] 8.2 Add keyboard shortcuts for other overlays (Ctrl+Shift+C for compile, etc.)
- [ ] 8.3 Update `src/components/hooks/useGraphHotkeys.ts` or create `useOverlayHotkeys.ts`
- [ ] 8.4 Display keyboard shortcuts in View menu tooltips

## 9. Accessibility

- [ ] 9.1 Add `role="dialog"` to FloatingOverlay Card
- [ ] 9.2 Add `aria-labelledby` pointing to CardTitle id
- [ ] 9.3 Implement focus trap within overlay when active (Tab cycles through overlay elements)
- [ ] 9.4 Add Escape key handler to close overlay and return focus to canvas
- [ ] 9.5 Test with screen reader (VoiceOver on macOS or NVDA on Windows)

## 10. Remove Legacy Overlay Node Rendering

- [ ] 10.1 Update `src/components/GraphNode.tsx` to remove overlay panel rendering logic (`renderEditorContent` for preview, compile, etc.)
- [ ] 10.2 Keep probe widget rendering in GraphNode (probe remains as ReactFlow node)
- [ ] 10.3 Keep note rendering in GraphNode (note remains as ReactFlow node)
- [ ] 10.4 Remove `editor_panel:preview|compile|graphdata|assets|properties` cases from GraphNode switch statement
- [ ] 10.5 Test that probe and note nodes still render correctly in ReactFlow

## 11. Node Definitions Update (Optional)

- [ ] 11.1 Add deprecation comments to `data/nodes/editor/preview.json`, `compile.json`, `graphdata.json`, `assets.json`, `properties.json`
- [ ] 11.2 Keep `data/nodes/editor/probe.json` and `note.json` as-is (still valid graph nodes)
- [ ] 11.3 Update node JSON schema validation to flag deprecated overlay nodes (optional, can defer)

## 12. Testing

- [ ] 12.1 Write E2E test: open overlay, drag, resize, verify position persists on reload (`e2e/overlay-workflow.spec.ts`)
- [ ] 12.2 Write E2E test: open multiple overlays, verify z-ordering click-to-front behavior
- [ ] 12.3 Write E2E test: save graph, verify overlay nodes excluded from JSON
- [ ] 12.4 Write E2E test: load legacy graph with overlay nodes, verify graceful degradation
- [ ] 12.5 Write E2E test: verify overlay independent of canvas zoom (zoom canvas, check overlay size)
- [ ] 12.6 Write unit tests for overlay state management and serialization exclusion
- [ ] 12.7 Run `bun run gates` and fix any linting/type errors
- [ ] 12.8 Achieve >80% coverage for new overlay code

## 13. Documentation

- [ ] 13.1 Update `docs/getting-started.md` with View menu and overlay usage
- [ ] 13.2 Update `AGENTS.md` repo policy: explain overlay system vs. graph nodes distinction
- [ ] 13.3 Add inline code comments in `overlayState.ts` and `FloatingOverlay.tsx`
- [ ] 13.4 Update `CHANGELOG.md` with breaking change note (legacy overlay nodes removed)

## 14. Validation and Cleanup

- [ ] 14.1 Run `bun run gates` (lint, typecheck, test, E2E)
- [ ] 14.2 Fix any failing tests or linter errors
- [ ] 14.3 Verify all TODOs in code are resolved or tracked
- [ ] 14.4 Request code review from maintainers
- [ ] 14.5 Archive OpenSpec change after merge and deployment
