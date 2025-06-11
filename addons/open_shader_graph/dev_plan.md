# OpenShaderGraph - Grouping and Subgraph Implementation Plan

## Overview
This plan outlines the implementation of Groups, Local Subgraphs, and Normal Subgraphs for the OpenShaderGraph plugin. The system will allow collapsing multiple nodes into single nodes while preserving connections and enabling reusability.

## ✅ Phase 1: Right-Click Context Menu Refactoring (COMPLETED)

### ✅ 1.1 Context Menu System
~~Current issue: GraphEdit captures all right-clicks for node creation.~~

**✅ IMPLEMENTED**: Multi-layered context menu system:
- ✅ Detect right-click target (background vs node vs selection)
- ✅ Show appropriate context menu based on target  
- ✅ Preserve existing node creation functionality for background clicks
- ✅ Context menu manager with proper action handling

### ✅ 1.2 Selection Management
- ✅ Implement proper multi-node selection handling
- ✅ Add visual feedback for selected nodes
- ✅ Track selection state in GraphEdit
- ✅ Rectangle selection with drag
- ✅ Ctrl+click multi-selection

### ✅ 1.3 Context Menu Options
For selected nodes:
- **Grouping** submenu (prepared for Phase 2):
  - Create Group (disabled, ready for Phase 2)
  - Create Local Subgraph (disabled, ready for Phase 2)
  - Create Normal Subgraph (disabled, ready for Phase 2)
- **Node operations**:
  - ✅ Delete (working)
  - Duplicate (placeholder)
  - Copy (placeholder)

## Phase 2: Node Group System

### 2.1 Group Node Implementation
Create base group node class:

```gdscript
class_name OpenShaderGroupNode extends BaseNode
- Properties: group_name, color, description
- Reference to OpenShaderSubgraphAsset
- Dynamic input/output pins based on internal graph
- Visual representation showing group name and pins
```

### 2.2 Group Creation Workflow
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

### 2.3 Input/Output Node System
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

## Phase 3: Local Subgraph System

### 3.1 Local Subgraph Implementation
Local subgraphs are identical to groups but with shared instances:

```gdscript
class_name OpenShaderLocalSubgraphNode extends OpenShaderGroupNode
- Maintains reference to shared subgraph asset
- Synchronizes changes across all instances
- Visual indicator to distinguish from regular groups
```

### 3.2 Instance Synchronization
- Implement observer pattern for subgraph changes
- Update all instances when one is modified
- Handle concurrent edits gracefully
- Preserve individual instance positions and names

### 3.3 Local Subgraph Registry
- Track all local subgraph definitions in main graph
- Prevent name conflicts
- Manage instance references

## Phase 4: Normal Subgraph System

### 4.1 External Subgraph References
```gdscript
class_name OpenShaderExternalSubgraphNode extends OpenShaderGroupNode
- File path reference to external .tres file
- Validation of file existence
- Error handling for missing files
```

### 4.2 Error Handling
- Red node visualization for missing subgraphs
- Error message display
- Graceful degradation when subgraph unavailable
- Refresh mechanism when file becomes available

### 4.3 Asset Management
- Track external dependencies
- Relative path resolution
- Asset validation on load

## Phase 5: Graph Editor Enhancement

### 5.1 Multi-Level Graph Editing
Implement hierarchical graph editing:

```gdscript
class_name OpenShaderGraphManager
- Manages stack of graph editing contexts
- Handles navigation between main graph and subgraphs
- Maintains editing history for undo/redo
```

### 5.2 Navigation System
- Double-click to enter subgraph editing
- Breadcrumb navigation for nested contexts
- Back/forward navigation buttons
- Visual indicators for current editing level

### 5.3 Editor UI Enhancements
- Tab system for multiple open graphs
- Context-aware properties panel
- Subgraph-specific toolbar options
- Preview window for subgraph contents

## Phase 6: Properties Panel Integration

### 6.1 Group Properties
When group/subgraph node selected:
- Name (editable, updates node title)
- Color (affects node appearance)
- Description (tooltip/help text)
- Pin management (add/remove/rename pins)

### 6.2 Input/Output Node Properties
When Input/Output node selected in subgraph:
- Pin management interface
- Type selection for each pin
- Name assignment for pins
- Validation of pin configurations

### 6.3 Dynamic Property Updates
- Real-time updates to node appearance
- Automatic pin reconfiguration
- Connection validation after changes

## Phase 7: YAML Serialization System

### 7.1 Minimal Data Format
Design efficient serialization:
- Node definitions (type, properties, position)
- Connection definitions (from/to references)
- Graph metadata (properties, settings)
- Exclude visual-only data (colors, UI state)

### 7.2 Recreation System
- Build GraphEdit from YAML data
- Restore node positions and properties
- Rebuild connections after all nodes created
- Handle missing node types gracefully

### 7.3 Version Compatibility
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
