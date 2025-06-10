# OpenShaderGraph - Grouping and Subgraph Implementation Plan

## Overview
This plan outlines the implementation of Groups, Local Subgraphs, and Normal Subgraphs for the OpenShaderGraph plugin. The system will allow collapsing multiple nodes into single nodes while preserving connections and enabling reusability.

## Phase 1: Project-Wide Refactoring for Best Practices

### 1.1 Repository Cleanup
- Relocate or remove `example_usage.gd` and other demo scripts into documentation
- Standardize file and directory naming (PascalCase for classes, snake_case for files)

### 1.2 GDScript Modernization
- Adopt static typing across all scripts (`var foo: Type`, typed function signatures)
- Replace dynamic property methods (`_get_property_list`, `_get`, `_set`) with `@export` variables and custom inspectors
- Use `@signal` annotations with typed arguments for all signals
- Guard or remove debug `print()` statements; use `push_error()` or a logging utility

### 1.3 Code Organization and Modularity
- Split large monolithic scripts (e.g., `gd_graph_edit.gd`, `gd_open_shader_editor.gd`) into dedicated modules: ConnectionManager, ResourceManager, NodeIndexManager, EditorUI, etc.
- Consolidate duplicated methods (e.g., duplicated `create_new_resource`) and remove dead code
- Centralize YAML serialization/deserialization in `gd_yaml_serializer.gd`

### 1.4 NodeFactory Improvements
- Refactor scanning logic to use Godot's `Directory` API with recursive directory scanning
- Implement caching and robust error handling for performance
- Provide manual registration hooks for plugin extensibility

### 1.5 UI and Scene Refactoring
- Refactor scenes (`.tscn`) to use `onready var` for control references and minimize code-based UI setup
- Rename scenes and controls for clarity; extract reusable UI components into separate scenes/scripts

### 1.6 Resource and Asset Class Consolidation
- Consolidate `duplicate_graph` implementations into a shared base class or mixin
- Standardize exported properties and metadata across `OpenShaderGraphAsset`, `OpenShaderMainAsset`, and `OpenShaderSubgraphAsset`
- Add versioning and migration helpers for resource schemas

### 1.7 Testing and Documentation
- Add unit tests for core modules, nodes, and resource serialization
- Integrate CI for linting, static analysis, and test execution
- Update README, inline documentation, and developer guide to reflect the new structure

After Phase 1, the codebase will adhere to Godot 4.x best practices—fully typed, modular, well-documented, and maintainable—providing a solid foundation for subsequent phases.

## Phase 2: Right-Click Context Menu Refactoring

### 2.1 Context Menu System
Current issue: GraphEdit captures all right-clicks for node creation.

**Solution**: Implement a multi-layered context menu system:
- Detect right-click target (background vs node vs selection)
- Show appropriate context menu based on target
- Preserve existing node creation functionality for background clicks

### 2.2 Selection Management
- Implement proper multi-node selection handling
- Add visual feedback for selected nodes
- Track selection state in GraphEdit

### 2.3 Context Menu Options
For selected nodes:
- **Grouping** submenu:
  - Create Group
  - Create Local Subgraph
  - Create Normal Subgraph
- **Node operations**:
  - Delete
  - Duplicate
  - Copy/Paste

## Phase 3: Node Group System

### 3.1 Group Node Implementation
Create base group node class:

```gdscript
class_name OpenShaderGroupNode extends BaseNode
- Properties: group_name, color, description
- Reference to OpenShaderSubgraphAsset
- Dynamic input/output pins based on internal graph
- Visual representation showing group name and pins
```

### 3.2 Group Creation Workflow
1. **Selection Analysis**: Analyze selected nodes to determine:
   - Input connections (from outside to selection)
   - Output connections (from selection to outside)
   - Internal connections (within selection)

2. **Interface Generation**: Create input/output definitions:
   - Map external input connections to group input pins
   - Map external output connections to group output pins
   - Preserve pin types and names

3. **Subgraph Creation**: 
   - Create new OpenShaderSubgraphAsset
   - Move selected nodes to subgraph
   - Add special Input/Output nodes for interface
   - Preserve internal connections

4. **Group Node Creation**:
   - Replace selection with single group node
   - Connect external connections to group pins
   - Set group properties (name, color, description)

### 3.3 Input/Output Node System
Special nodes for group interfaces:

```gdscript
class_name OpenShaderGroupInput extends BaseNode
- Only available in subgraphs
- Only one instance allowed per subgraph
- Dynamic output pins based on group interface
- Properties panel allows adding/removing pins

class_name OpenShaderGroupOutput extends BaseNode
- Only available in subgraphs
- Only one instance allowed per subgraph
- Dynamic input pins based on group interface
- Properties panel allows adding/removing pins
```

## Phase 4: Local Subgraph System

### 4.1 Local Subgraph Implementation
Local subgraphs are identical to groups but with shared instances:

```gdscript
class_name OpenShaderLocalSubgraphNode extends OpenShaderGroupNode
- Maintains reference to shared subgraph asset
- Synchronizes changes across all instances
- Visual indicator to distinguish from regular groups
```

### 4.2 Instance Synchronization
- Implement observer pattern for subgraph changes
- Update all instances when one is modified
- Handle concurrent edits gracefully
- Preserve individual instance positions and names

### 4.3 Local Subgraph Registry
- Track all local subgraph definitions in main graph
- Prevent name conflicts
- Manage instance references

## Phase 5: Normal Subgraph System

### 5.1 External Subgraph References
```gdscript
class_name OpenShaderExternalSubgraphNode extends OpenShaderGroupNode
- File path reference to external .tres file
- Validation of file existence
- Error handling for missing files
```

### 5.2 Error Handling
- Red node visualization for missing subgraphs
- Error message display
- Graceful degradation when subgraph unavailable
- Refresh mechanism when file becomes available

### 5.3 Asset Management
- Track external dependencies
- Relative path resolution
- Asset validation on load

## Phase 6: Graph Editor Enhancement

### 6.1 Multi-Level Graph Editing
Implement hierarchical graph editing:

```gdscript
class_name OpenShaderGraphManager
- Manages stack of graph editing contexts
- Handles navigation between main graph and subgraphs
- Maintains editing history for undo/redo
```

### 6.2 Navigation System
- Double-click to enter subgraph editing
- Breadcrumb navigation for nested contexts
- Back/forward navigation buttons
- Visual indicators for current editing level

### 6.3 Editor UI Enhancements
- Tab system for multiple open graphs
- Context-aware properties panel
- Subgraph-specific toolbar options
- Preview window for subgraph contents

## Phase 7: Properties Panel Integration

### 7.1 Group Properties
When group/subgraph node selected:
- Name (editable, updates node title)
- Color (affects node appearance)
- Description (tooltip/help text)
- Pin management (add/remove/rename pins)

### 7.2 Input/Output Node Properties
When Input/Output node selected in subgraph:
- Pin management interface
- Type selection for each pin
- Name assignment for pins
- Validation of pin configurations

### 7.3 Dynamic Property Updates
- Real-time updates to node appearance
- Automatic pin reconfiguration
- Connection validation after changes

## Phase 8: YAML Serialization System

### 8.1 Minimal Data Format
Design efficient serialization:
- Node definitions (type, properties, position)
- Connection definitions (from/to references)
- Graph metadata (properties, settings)
- Exclude visual-only data (colors, UI state)

### 8.2 Recreation System
- Build GraphEdit from YAML data
- Restore node positions and properties
- Rebuild connections after all nodes created
- Handle missing node types gracefully

### 8.3 Version Compatibility
- Schema versioning for future updates
- Migration system for older formats
- Backward compatibility maintenance

## Phase 9: Integration and Testing

### 9.1 Existing System Integration
- Update NodeFactory for new node types
- Integrate with existing connection system
- Maintain compatibility with current nodes
- Update shader code generation system

### 9.2 Error Handling
- Validation of circular references
- Prevention of infinite nesting
- Resource corruption recovery
- User-friendly error messages

### 9.3 Performance Optimization
- Lazy loading of subgraph contents
- Efficient instance synchronization
- Memory management for large graphs
- UI responsiveness during operations

## Implementation Order

### Phase 1: Foundation (Week 1-2)
1. Create resource class hierarchy
2. Implement basic serialization/deserialization
3. Add resource management utilities

### Phase 2: Context Menu (Week 2-3)
1. Refactor right-click handling
2. Implement selection management
3. Create context menu system

### Phase 3: Basic Groups (Week 3-5)
1. Implement group creation workflow
2. Create Input/Output node system
3. Add basic group functionality

### Phase 4: Local Subgraphs (Week 5-6)
1. Extend groups to local subgraphs
2. Implement instance synchronization
3. Add local subgraph registry

### Phase 5: External Subgraphs (Week 6-7)
1. Implement external file references
2. Add error handling for missing files
3. Create asset management system

### Phase 6: Editor Enhancement (Week 7-8)
1. Implement multi-level editing
2. Add navigation system
3. Create enhanced UI components

### Phase 7: Properties Integration (Week 8-9)
1. Extend properties panel
2. Add dynamic property updates
3. Implement pin management

### Phase 8: YAML System (Week 9-10)
1. Design minimal data format
2. Implement recreation system
3. Add version compatibility

### Phase 9: Integration (Week 10-11)
1. Integrate with existing systems
2. Add comprehensive error handling
3. Optimize performance

## File Structure

```
addons/open_shader_graph/
├── scripts/
│   ├── resources/
│   │   ├── gd_open_shader_graph_asset.gd
│   │   ├── gd_open_shader_main_asset.gd
│   │   └── gd_open_shader_subgraph_asset.gd
│   ├── nodes/
│   │   ├── groups/
│   │   │   ├── gd_open_shader_group_node.gd
│   │   │   ├── gd_open_shader_local_subgraph_node.gd
│   │   │   ├── gd_open_shader_external_subgraph_node.gd
│   │   │   ├── gd_open_shader_group_input.gd
│   │   │   └── gd_open_shader_group_output.gd
│   │   └── [existing nodes...]
│   ├── core/
│   │   ├── gd_graph_manager.gd
│   │   ├── gd_context_menu.gd
│   │   ├── gd_selection_manager.gd
│   │   └── gd_yaml_serializer.gd
│   └── [existing scripts...]
└── [existing structure...]
```

## Risk Assessment

### High Risk
- Complex connection management during grouping
- Instance synchronization for local subgraphs
- Potential circular reference issues

### Medium Risk
- Right-click context menu conflicts
- Resource loading performance
- UI complexity for nested editing

### Low Risk
- Basic resource serialization
- Properties panel extensions
- YAML format implementation

## Success Criteria

1. **Functionality**:
   - Groups can be created from selected nodes
   - Local subgraphs synchronize across instances
   - External subgraphs load from .tres files
   - Nested groups work correctly

2. **Usability**:
   - Intuitive creation workflow
   - Clear visual distinctions
   - Responsive editing experience
   - Comprehensive error handling

3. **Performance**:
   - Fast group creation/editing
   - Efficient resource loading
   - Minimal memory overhead
   - Smooth UI interactions

4. **Reliability**:
   - Robust error handling
   - Data integrity preservation
   - Graceful failure recovery
   - Consistent behavior across operations

## Testing Strategy

### Unit Tests
- Resource serialization/deserialization
- Connection management during grouping
- Pin type validation
- YAML parsing and generation

### Integration Tests
- Full group creation workflow
- Multi-level graph editing
- Instance synchronization
- External subgraph loading

### User Experience Tests
- Context menu usability
- Navigation between graph levels
- Properties panel functionality
- Error message clarity

This plan provides a comprehensive roadmap for implementing the grouping and subgraph features while maintaining the existing plugin architecture and ensuring robust functionality. 