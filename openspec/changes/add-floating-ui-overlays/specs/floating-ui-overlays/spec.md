# Floating UI Overlays

## ADDED Requirements

### Requirement: Overlay Container

The system SHALL render a dedicated overlay container above the ReactFlow canvas to host floating UI panels.

#### Scenario: Container renders above canvas

- **WHEN** the App component renders
- **THEN** an overlay container is rendered with `position: absolute` z-index above the ReactFlow canvas
- **AND** the container spans the full editor region

#### Scenario: Container does not interfere with graph interactions

- **WHEN** a user clicks on the canvas background (not on an overlay)
- **THEN** the click event reaches the ReactFlow canvas
- **AND** the user can pan, zoom, and interact with graph nodes normally

### Requirement: Drag and Resize

Floating overlays SHALL support free movement and resizing within the editor region using `react-rnd`.

#### Scenario: User drags overlay to new position

- **WHEN** a user drags an overlay by its header
- **THEN** the overlay moves smoothly following the cursor
- **AND** the new position is persisted to application state
- **AND** graph data is NOT modified or recompiled

#### Scenario: User resizes overlay

- **WHEN** a user drags an overlay's resize handle
- **THEN** the overlay dimensions update smoothly
- **AND** the new size is persisted to application state
- **AND** graph data is NOT modified or recompiled

#### Scenario: Overlay constrained to editor bounds

- **WHEN** a user attempts to drag an overlay outside the editor region
- **THEN** the overlay is constrained to remain within the editor bounds
- **AND** the overlay does not cover the menubar or sidebar

### Requirement: Application-Level State

Overlay positions, sizes, and visibility SHALL be stored in application state (localStorage) and persist across different graphs.

#### Scenario: Overlay state persists across graphs

- **WHEN** a user opens graph A with the preview overlay visible at position (100, 200)
- **AND** the user opens graph B
- **THEN** the preview overlay remains visible at position (100, 200)

#### Scenario: Overlay state persists across sessions

- **WHEN** a user positions the compile overlay at (300, 150) with size 400x300
- **AND** the user closes and reopens the application
- **THEN** the compile overlay is restored at position (300, 150) with size 400x300

#### Scenario: Default overlay state on first run

- **WHEN** a user opens the application for the first time
- **THEN** overlays are hidden by default
- **AND** default positions/sizes are provided (preview top-right, compile below preview, etc.)

### Requirement: Visual Consistency

Overlays SHALL use shadcn Card components and maintain consistent styling with the rest of the UI.

#### Scenario: Overlay styled with shadcn Card

- **WHEN** an overlay is rendered
- **THEN** it is wrapped in a shadcn Card component
- **AND** the Card includes CardHeader with title and CardContent with panel content
- **AND** the Card uses theme tokens (colors, borders, shadows) consistent with other UI panels

#### Scenario: Overlay independent of canvas zoom

- **WHEN** a user zooms the ReactFlow canvas to 50%
- **THEN** overlay size and position remain unchanged (absolute coordinates)
- **AND** overlay text remains readable at the same font size

### Requirement: Overlay Types

The system SHALL provide five floating overlay types: preview, compile, graphdata, assets, and properties.

#### Scenario: Preview overlay displays 3D preview panel

- **WHEN** the preview overlay is visible
- **THEN** it renders the PreviewPanel component with full functionality
- **AND** the overlay can be dragged and resized independently of the canvas

#### Scenario: Compile overlay displays compile panel

- **WHEN** the compile overlay is visible
- **THEN** it renders the CompilePanel component with code output
- **AND** the overlay can be dragged and resized independently of the canvas

#### Scenario: GraphData overlay displays graph JSON

- **WHEN** the graphdata overlay is visible
- **THEN** it renders the GraphDataPanel component with JSON output
- **AND** the overlay can be dragged and resized independently of the canvas

#### Scenario: Assets overlay displays asset library

- **WHEN** the assets overlay is visible
- **THEN** it renders the AssetsPanel component with asset browser
- **AND** the overlay can be dragged and resized independently of the canvas

#### Scenario: Properties overlay displays node properties

- **WHEN** the properties overlay is visible
- **THEN** it renders the PropertiesPanel component for the selected node
- **AND** the overlay can be dragged and resized independently of the canvas

### Requirement: Overlay Visibility Toggle

Users SHALL be able to show and hide overlays via a centralized API and View menu.

#### Scenario: Toggle overlay visibility

- **WHEN** a user clicks the preview overlay toggle in the View menu
- **THEN** the preview overlay visibility is toggled (shown if hidden, hidden if shown)
- **AND** the new visibility state is persisted to application state

#### Scenario: Close button hides overlay

- **WHEN** a user clicks the close button on an overlay
- **THEN** the overlay is hidden
- **AND** the visibility state is persisted to application state

#### Scenario: Keyboard shortcut toggles overlay

- **WHEN** a user presses a keyboard shortcut (e.g., Ctrl+Shift+P for preview)
- **THEN** the corresponding overlay visibility is toggled

### Requirement: Z-ordering

Overlays SHALL bring-to-front on interaction to prevent occlusion issues.

#### Scenario: Click brings overlay to front

- **WHEN** a user clicks on an overlay that is partially covered by another overlay
- **THEN** the clicked overlay's z-index is increased to render above other overlays
- **AND** the z-index order is persisted to application state

#### Scenario: Drag brings overlay to front

- **WHEN** a user drags an overlay
- **THEN** the overlay is brought to front before the drag starts
- **AND** the overlay remains in front until another overlay is interacted with

### Requirement: Centralized State Management

Overlay state SHALL be managed via React Context (`OverlayContext`) with a centralized API.

#### Scenario: OverlayContext provides state and updaters

- **WHEN** a component calls `useOverlay('preview')`
- **THEN** the hook returns the preview overlay state (x, y, width, height, visible, zIndex)
- **AND** the hook provides updater functions (`toggleOverlay`, `updateOverlayBounds`)

#### Scenario: State updates trigger re-renders

- **WHEN** overlay state is updated via `updateOverlayBounds('preview', { x: 200, y: 300 })`
- **THEN** all components using `useOverlay('preview')` re-render with the new state
- **AND** the updated state is persisted to localStorage

### Requirement: Accessibility

Overlays SHALL be keyboard-navigable and support focus management.

#### Scenario: Tab navigation within overlay

- **WHEN** an overlay is visible and focused
- **AND** the user presses Tab
- **THEN** focus cycles through interactive elements within the overlay (buttons, inputs, etc.)
- **AND** focus does not escape to the canvas until Shift+Tab on the first element or Tab on the last element

#### Scenario: Escape key closes overlay

- **WHEN** an overlay is focused
- **AND** the user presses Escape
- **THEN** the overlay is hidden
- **AND** focus returns to the main canvas

#### Scenario: ARIA labels for screen readers

- **WHEN** an overlay is rendered
- **THEN** it includes appropriate ARIA attributes (`role="dialog"`, `aria-labelledby` for title)
- **AND** screen readers announce the overlay type and content
