# Graph Serialization

## MODIFIED Requirements

### Requirement: Serialize Graph Nodes Only

The system SHALL exclude UI overlay editor nodes from graph serialization, saving only shader logic nodes and graph-category editor nodes (probe, note).

#### Scenario: Overlay nodes excluded from save

- **WHEN** a user saves a graph
- **AND** UI overlay nodes (preview, compile, graphdata, assets, properties) are NOT part of the ReactFlow graph state
- **THEN** the serialized JSON contains only shader logic nodes and graph editor nodes (probe, note)
- **AND** overlay state is NOT included in the graph file

#### Scenario: Probe and note nodes included in save

- **WHEN** a user saves a graph containing probe and note nodes
- **THEN** those nodes are included in the serialized JSON
- **AND** their positions, properties, and connections are preserved

#### Scenario: Legacy overlay nodes stripped on save

- **WHEN** a user loads a legacy graph containing overlay-type editor nodes (preview, compile, etc.)
- **AND** the user saves the graph
- **THEN** the overlay nodes are NOT included in the saved JSON
- **AND** the saved graph contains only shader logic nodes and graph editor nodes

### Requirement: ReactFlow Graph Build Excludes Overlays

The system SHALL filter out UI overlay editor nodes when building the ReactFlow graph from canonical data.

#### Scenario: Overlay nodes filtered during graph build

- **WHEN** the system builds the ReactFlow graph from canonical node data
- **THEN** nodes with `editor_panel:preview|compile|graphdata|assets|properties` meta are excluded
- **AND** only shader logic nodes and graph editor nodes (probe, note) are included in the ReactFlow graph

#### Scenario: Legacy graph loaded without overlay nodes

- **WHEN** a user loads a legacy graph containing overlay-type editor nodes
- **THEN** those nodes do NOT appear in the ReactFlow canvas
- **AND** the graph renders normally with only shader logic nodes and graph editor nodes
- **AND** no error is thrown or displayed to the user

### Requirement: Backward Compatibility

The system SHALL gracefully handle legacy graphs containing overlay-type editor nodes by filtering them out without errors.

#### Scenario: Legacy graph loads successfully

- **WHEN** a user opens a graph file created before the overlay system
- **AND** the graph contains overlay-type editor nodes (preview, compile, etc.)
- **THEN** the graph loads without errors
- **AND** overlay nodes are silently filtered out
- **AND** shader logic nodes and graph editor nodes render normally

#### Scenario: No migration prompt for filtered nodes

- **WHEN** overlay nodes are filtered from a legacy graph
- **THEN** the user is NOT shown a migration prompt or warning
- **AND** the user can re-open overlays from the View menu if needed
