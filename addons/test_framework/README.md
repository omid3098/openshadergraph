# Test Framework for Godot

A comprehensive testing framework for Godot 4.x projects that provides unit testing capabilities with lifecycle methods and assertion utilities.

## Features

- **Resource-based test execution** with inspector integration
- **Automatic test discovery** - scans directories for test files that extend BaseTest
- **Lifecycle methods**: `before_all`, `before_each`, `after_each`, `after_all`
- **Comprehensive assertion methods** for various data types
- **Configurable test directories** with recursive scanning
- **Detailed test reporting** with execution times
- **Inspector button** for easy test execution

## Installation

1. Copy the `test_framework` folder to your project's `addons/` directory
2. Enable the "Test Framework" plugin in Project Settings > Plugins
3. The plugin will automatically register the TestFramework resource type

## Quick Start

### 1. Use the Provided Test Framework Resource

The plugin provides a ready-to-use TestFramework resource at the project root:
- Select `test_framework.tres` in the FileSystem dock
- The resource is pre-configured to automatically discover tests in the `res://tests/` directory

### 2. Create Your First Test

Create a new script in the `tests/` directory that extends `BaseTest`:

**File: `tests/my_first_test.gd`**
```gdscript
@tool
extends BaseTest
class_name MyFirstTest

# Optional: Setup that runs once before all tests
func before_all():
    print("Setting up test suite...")

# Optional: Setup that runs before each test
func before_each():
    print("Setting up individual test...")

# Optional: Cleanup that runs after each test
func after_each():
    print("Cleaning up individual test...")

# Optional: Cleanup that runs once after all tests
func after_all():
    print("Tearing down test suite...")

# Test methods must start with "test_"
func test_basic_math():
    assert_equal(4, 2 + 2, "Addition should work correctly")
    assert_not_equal(5, 2 + 2, "2 + 2 should not equal 5")

func test_string_operations():
    var text = "Hello, World!"
    assert_contains(text, "World", "Text should contain 'World'")
    assert_type(text, TYPE_STRING, "Should be a string type")
```

### 3. Run Your Tests

1. Select the `test_framework.tres` resource in the FileSystem dock
2. In the Inspector panel, click the "Run All Tests" button
3. Check the Output panel for test results

The framework will automatically discover all test files in the configured directories (`res://tests/` by default) and execute them.

## Available Assertion Methods

The `BaseTest` class provides the following assertion methods:

### Boolean Assertions
- `assert_true(condition, message)` - Assert condition is true
- `assert_false(condition, message)` - Assert condition is false

### Equality Assertions
- `assert_equal(expected, actual, message)` - Assert values are equal
- `assert_not_equal(expected, actual, message)` - Assert values are not equal

### Null Assertions
- `assert_null(value, message)` - Assert value is null
- `assert_not_null(value, message)` - Assert value is not null

### Numerical Comparisons
- `assert_greater_than(actual, expected, message)` - Assert actual > expected
- `assert_less_than(actual, expected, message)` - Assert actual < expected

### Container Assertions
- `assert_contains(container, item, message)` - Assert container contains item
  - Works with Arrays, Dictionaries, and Strings

### Type Assertions
- `assert_type(value, expected_type, message)` - Assert value is of expected type
  - Use Godot's TYPE_* constants (TYPE_INT, TYPE_STRING, etc.)

## Lifecycle Methods

All lifecycle methods are optional and can be overridden in your test classes:

- **`before_all()`** - Called once before all tests in the class
- **`before_each()`** - Called before each individual test method
- **`after_each()`** - Called after each individual test method
- **`after_all()`** - Called once after all tests in the class

## Test Framework Configuration

The TestFramework resource has the following configuration options:

- **`show_detailed_output`** - Show detailed output for each test (default: true)
- **`stop_on_first_failure`** - Stop execution on first test failure (default: false)
- **`test_directories`** - Array of directories to scan for test files (default: ["res://tests/"])

### Automatic Test Discovery

The framework automatically discovers test files by:
1. Scanning all directories specified in `test_directories`
2. Recursively searching subdirectories
3. Looking for `.gd` files that extend `BaseTest`
4. Automatically instantiating and registering these test classes

No manual registration is required - just place your test files in the configured directories!

## Example Test Output

```
=== Starting Test Execution ===
No tests registered, performing automatic discovery...
TestRunner: Discovering and registering tests...
TestRunner: Scanning directory: res://tests/
TestRunner: Found test class: res://tests/my_first_test.gd
TestRunner: Scanning examples directory: res://addons/test_framework/examples/
TestRunner: Found test class: res://addons/test_framework/examples/example_unit_test.gd
TestRunner: Test discovery completed - found 2 test classes
Registered test: my_first_test
Registered test: example_unit_test
Found 8 tests to execute
MyFirstTest: Setting up test suite...
MyFirstTest: Preparing for test...
[PASS] test_arithmetic_operations - PASSED (0.001s)
MyFirstTest: Cleaning up after test...
...

=== Test Results Summary ===
Total Tests: 8
Passed: 8
Failed: 0
Success Rate: 100.0%
```

## File Structure

```
addons/test_framework/
├── plugin.cfg                          # Plugin configuration
├── gd_plugin.gd                        # Main plugin script
├── test_framework.gd                   # TestFramework resource class
├── base_test.gd                        # Base test class with assertions
├── test_runner.gd                      # Test discovery and registration
├── test_framework_inspector_plugin.gd  # Inspector integration
├── example_test_framework.tres         # Example TestFramework resource
├── examples/
│   └── example_unit_test.gd            # Example test implementation
└── README.md                           # This documentation
```

## Advanced Usage

### Custom Test Directories

You can configure custom test directories by modifying the `test_directories` property in your TestFramework resource:

```gdscript
# In your TestFramework resource
test_directories = ["res://tests/", "res://unit_tests/", "res://integration_tests/"]
```

### Custom Test Discovery

The automatic test discovery can be customized by modifying the `TestRunner` class. The discovery process:
1. Scans all directories in `test_directories` recursively
2. Loads `.gd` files and checks if they extend `BaseTest`
3. Automatically instantiates and registers valid test classes

### Signals

The TestFramework emits the following signals:

- `test_started(test_name: String)` - When a test begins
- `test_completed(test_name: String, passed: bool, message: String)` - When a test completes
- `all_tests_completed(total_tests: int, passed_tests: int, failed_tests: int)` - When all tests finish

### Integration with CI/CD

You can create a headless test runner by calling `TestFramework.execute_all_tests()` programmatically and checking the results for automated testing pipelines. 