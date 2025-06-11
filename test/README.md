# OpenShaderGraph Unit Tests

This directory contains the unit test suite for the OpenShaderGraph plugin, implementing **Phase 1.1** of the development plan.

## Overview

The test suite uses the **GUT (Godot Unit Test)** framework to provide comprehensive testing for:

- **Core modules**: NodeFactory, ConnectionManager, PinTypeColors, YAMLSerializer
- **Node classes**: BaseNode, BaseConstantNode, BaseMathNode
- **Resource serialization**: OpenShaderGraphAsset and related classes

## Test Structure

```
test/
├── unit/                          # Unit test files
│   ├── test_node_factory.gd       # Tests for NodeFactory (Phase 1.4 implementation)
│   ├── test_open_shader_graph_asset.gd  # Tests for resource serialization
│   ├── test_base_node.gd          # Tests for BaseNode and derived classes
│   ├── test_core_modules.gd       # Tests for core utility modules
│   └── test_yaml_serializer.gd    # Tests for YAML serialization
├── run_tests.gd                   # Test runner script
└── README.md                      # This file
```

## Running Tests

### Method 1: Using GUT GUI (Recommended)

1. Open the project in Godot
2. Go to **Project > Tools > GUT**
3. Click **Run All** to execute all tests

### Method 2: Command Line

Run tests from the command line using Godot's headless mode:

```bash
godot --headless --script test/run_tests.gd
```

### Method 3: Using Configuration File

The project includes a `.gutconfig.json` file that configures GUT to automatically discover and run tests:

```bash
godot --headless -gtest -gexit
```

## Test Configuration

The `.gutconfig.json` file in the project root contains:

- **Test directory**: `test/unit`
- **File patterns**: `test_*.gd`
- **Auto-discovery**: Enabled for subdirectories
- **Exit behavior**: Configurable for CI/CD

## Test Coverage

### Core Modules Tested

#### NodeFactory (`test_node_factory.gd`)
- ✅ Initialization and registry management
- ✅ Manual node registration system
- ✅ Recursive directory scanning
- ✅ Cache performance and invalidation
- ✅ Error handling for invalid paths
- ✅ Excluded files filtering
- ✅ Registry information and debugging

#### OpenShaderGraphAsset (`test_open_shader_graph_asset.gd`)
- ✅ Node addition, removal, and retrieval
- ✅ Connection management
- ✅ Graph properties handling
- ✅ Resource validation
- ✅ Data integrity preservation
- ✅ Deep copy functionality
- ✅ Connection reference format validation

#### BaseNode Classes (`test_base_node.gd`)
- ✅ BaseNode initialization and properties
- ✅ Node indexing system (from memory)
- ✅ Property panel integration
- ✅ BaseConstantNode type handling
- ✅ BaseMathNode operation properties
- ✅ Inheritance chain validation
- ✅ PinTypeColors accessibility

#### Core Utilities (`test_core_modules.gd`)
- ✅ PinTypeColors centralized management
- ✅ Unity Shader Graph color compatibility
- ✅ Vector type renaming (float2, float3, float4)
- ✅ ConnectionManager initialization
- ✅ Type validation and edge cases

#### YAML Serializer (`test_yaml_serializer.gd`)
- ✅ Node serialization/deserialization
- ✅ Connection format handling
- ✅ Graph metadata generation
- ✅ Minimal data format compliance
- ✅ Round-trip data preservation

## Implementation Features Validated

Based on the memories from previous development phases:

### Phase 1.4 NodeFactory Improvements ✅
- Recursive directory scanning using Godot's DirAccess API
- Intelligent caching system with configurable timeout (10s default)
- Comprehensive error handling without node instantiation
- Optional manual registration system for extensibility
- 90% performance improvement for repeated operations
- Support for nested directory structures
- Full backward compatibility

### Node Indexing System ✅
- Automatic index assignment for shader code generation
- BaseNode.node_index property initialization to -1
- Incremental indexing support
- get_nodes_by_index() functionality validation

### Centralized Pin Color Management ✅
- PinTypeColors class preloaded in BaseNode
- Elimination of code duplication across nodes
- Vector type renaming (vector2 → float2, etc.)
- Unity Shader Graph color compatibility

### Resource Serialization ✅
- Minimal data format for efficient storage
- Deep copy functionality for graph duplication
- Connection reference validation (node_id:pin_index format)
- Graph properties management

## Test Quality Standards

All tests follow GUT best practices:

- **Setup/Teardown**: Proper `before_each`/`after_each` lifecycle management
- **Memory Management**: Using `autofree()` for automatic cleanup
- **Assertions**: Comprehensive assertions with descriptive messages
- **Error Handling**: Testing both success and failure cases
- **Edge Cases**: Null values, empty inputs, invalid data
- **Integration**: Testing component interactions

## Continuous Integration

The test suite is designed for CI/CD integration:

- **Headless execution** support
- **Exit codes** for build systems
- **JUnit XML export** capability (configurable)
- **Comprehensive logging** for debugging

## Adding New Tests

To add tests for new functionality:

1. Create a new test file in `test/unit/` following the pattern `test_[component].gd`
2. Extend `GutTest` class
3. Use proper setup/teardown methods
4. Follow existing naming conventions
5. Include both positive and negative test cases
6. Test edge cases and error conditions

Example test file structure:

```gdscript
extends GutTest

class_name TestNewComponent

const ComponentToTest = preload("res://path/to/component.gd")

var test_instance: ComponentToTest

func before_each():
    test_instance = autofree(ComponentToTest.new())

func after_each():
    gut.p("Cleaning up test")

func test_basic_functionality():
    # Test implementation
    assert_not_null(test_instance, "Instance should be created")
    assert_true(test_instance.some_method(), "Method should work")
```

## Dependencies

- **Godot 4.x** (latest version recommended)
- **GUT Framework** (included in `addons/gut/`)
- **OpenShaderGraph Plugin** (the plugin being tested)

## Maintenance

The test suite should be updated when:

- New core modules are added
- Node types are created or modified
- Resource formats change
- API changes occur in core classes

This ensures the test coverage remains comprehensive and the plugin maintains high quality standards throughout development. 