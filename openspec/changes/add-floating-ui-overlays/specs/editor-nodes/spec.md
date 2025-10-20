# Editor Nodes

## ADDED Requirements

### Requirement: Editor Node Definition

Editor nodes SHALL be true graph nodes that participate in the shader graph data model, specifically probe and note. UI panels (preview, compile, graphdata, assets, properties) are NOT editor nodes.

#### Scenario: Editor nodes are graph nodes

- **WHEN** a node is classified as an editor node
- **THEN** it is one of: probe (has input pin) or note (text annotation)
- **AND** the node is rendered as a ReactFlow node
- **AND** the node is included in graph serialization
- **AND** the node behaves like other shader logic nodes (movable, connectable, saved with graph)

#### Scenario: UI panels are not nodes

- **WHEN** a UI panel (preview, compile, graphdata, assets, properties) is displayed
- **THEN** it is NOT a node and NOT rendered as a ReactFlow node
- **AND** it is NOT included in the node palette or graph data model
- **AND** it is accessed via the View menu as a floating overlay
- **AND** it is NOT serialized with graph data

## MODIFIED Requirements

### Requirement: Editor Node Rendering

Editor nodes SHALL render as ReactFlow nodes in the graph canvas.

#### Scenario: Editor nodes render in ReactFlow

- **WHEN** an editor node (probe or note) is present in the graph
- **THEN** it is rendered as a ReactFlow node with standard node styling
- **AND** the node can be moved, resized, and connected like other shader nodes
- **AND** the node participates in graph layout and zoom

#### Scenario: Legacy UI panel pseudo-nodes filtered on load

- **WHEN** a legacy graph is loaded containing UI panel nodes incorrectly stored as editor nodes (preview, compile, graphdata, assets, properties)
- **THEN** those nodes are filtered out during graph build (they were never meant to be nodes)
- **AND** the user is NOT notified (graceful degradation)
- **AND** the user can open UI panels from the View menu instead

### Requirement: Probe Node Behavior

The probe node SHALL remain a graph node with input pin and behave like other default nodes.

#### Scenario: Probe node accepts connections

- **WHEN** a user connects an output pin to the probe node's input
- **THEN** the connection is established
- **AND** the probe displays the input value in real-time

#### Scenario: Probe node saved with graph

- **WHEN** a graph containing a probe node is saved
- **THEN** the probe node is included in the serialized graph data
- **AND** the probe node's position and connections are preserved

### Requirement: Note Node Behavior

The note node SHALL remain a graph node (no pins) and behave like other default nodes.

#### Scenario: Note node persists with graph

- **WHEN** a graph containing a note node is saved
- **THEN** the note node is included in the serialized graph data
- **AND** the note's text content and position are preserved

#### Scenario: Note node participates in graph layout

- **WHEN** a user moves or resizes a note node
- **THEN** the node updates like other ReactFlow nodes
- **AND** the graph data is updated
- **AND** the note can be selected, duplicated, and deleted like other nodes

## REMOVED Requirements

### Requirement: UI Panels Implemented as Editor Nodes

**Reason**: Preview, compile, graphdata, assets, and properties panels were incorrectly implemented as ReactFlow "editor nodes" due to previous implementation issues. They are being restored as View menu UI panels (floating overlays), not nodes. Only probe and note remain as true editor nodes.

**Migration**: Legacy graphs with UI panel pseudo-nodes (preview.json, compile.json, etc.) will have those nodes filtered out on load. Users can open panels from the View menu instead. Probe and note nodes are unaffected.
