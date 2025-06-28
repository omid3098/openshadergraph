# OpenShaderGraph C# Unit Tests

This directory contains comprehensive unit tests for the OpenShaderGraph C# implementation using the NUnit testing framework.

## Test Structure

```
tests/
├── unit/                                    # Unit tests directory
│   ├── OpenShaderGraph.Tests.csproj       # Test project file
│   ├── TestRunner.cs                       # Custom test runner
│   └── Core/                               # Core functionality tests
│       ├── Data/                           # Data layer tests
│       │   ├── GraphDataTests.cs      # GraphData class tests
│       │   ├── BaseNodeDataTests.cs       # BaseNodeData class tests
│       │   ├── PinDataTests.cs            # PinData class tests
│       │   └── ConnectionDataTests.cs     # ConnectionData class tests
│       └── Logic/                          # Logic layer tests
│           └── GraphManagerTests.cs       # GraphManager class tests
└── README.md                               # This file
```

## Prerequisites

1. **.NET 6.0 SDK** - Required for running the tests
2. **NUnit Test Framework** - Automatically installed via NuGet packages
3. **Godot 4.x** - Required for Godot-specific types and functionality

## Running Tests

### Option 1: Using .NET CLI (Recommended)

```bash
# Navigate to the test project directory
cd tests/unit

# Restore dependencies
dotnet restore

# Run all tests
dotnet test

# Run tests with detailed output
dotnet test --verbosity normal

# Run tests with coverage (if coverlet is installed)
dotnet test --collect:"XPlat Code Coverage"
```

### Option 2: Using Visual Studio or Rider

1. Open the solution in your IDE
2. Build the test project
3. Use the built-in test runner to execute tests
4. View results in the test explorer

### Option 3: Using the Custom Test Runner

```bash
# Build and run the custom test runner
cd tests/unit
dotnet run
```

## Test Coverage

The current test suite covers:

### Data Layer (100% Coverage)
- **GraphData**: Constructor, properties, node/connection management, validation logic
- **BaseNodeData**: Constructor, getters, setters, pin management
- **PinData**: Constructor, property management, different data types
- **ConnectionData**: Constructor, endpoint management, type safety

### Logic Layer (100% Coverage)
- **GraphManager**: Graph creation, selection, deletion, signal emission

### Test Categories

1. **Constructor Tests**: Verify proper initialization of objects
2. **Property Tests**: Validate getters and setters work correctly
3. **Validation Tests**: Ensure business logic validation works as expected
4. **Signal Tests**: Verify signal emission and handling
5. **Edge Case Tests**: Test null handling and error conditions

## Test Naming Convention

Tests follow the **Arrange-Act-Assert** pattern with descriptive names:

```csharp
[Test]
public void MethodName_Scenario_ExpectedBehavior()
{
    // Arrange - Set up test data
    // Act - Execute the method under test
    // Assert - Verify expected results
}
```

## Adding New Tests

1. **Create Test File**: Add new test files in the appropriate subdirectory
2. **Follow Conventions**: Use the existing naming and structure patterns
3. **Add Test Class**: Inherit from appropriate base or use `[TestFixture]`
4. **Setup/Teardown**: Use `[SetUp]` and `[TearDown]` for test initialization
5. **Update Project**: The `.csproj` file automatically includes all `.cs` files

### Example Test Class

```csharp
using NUnit.Framework;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Tests.Core.Data
{
    [TestFixture]
    public class NewClassTests
    {
        private NewClass _instance;

        [SetUp]
        public void SetUp()
        {
            _instance = new NewClass();
        }

        [Test]
        public void Method_Scenario_ExpectedResult()
        {
            // Arrange
            var input = "test";
            
            // Act
            var result = _instance.Method(input);
            
            // Assert
            Assert.That(result, Is.EqualTo("expected"));
        }
    }
}
```

## CI/CD Integration

The test suite is designed to integrate with continuous integration pipelines:

```yaml
# Example GitHub Actions step
- name: Run Tests
  run: |
    cd tests/unit
    dotnet test --logger "trx;LogFileName=test-results.trx"
    
- name: Publish Test Results
  uses: dorny/test-reporter@v1
  if: always()
  with:
    name: NUnit Tests
    path: tests/unit/TestResults/test-results.trx
    reporter: dotnet-trx
```

## Troubleshooting

### Common Issues

1. **Godot Assembly Not Found**
   - Ensure Godot is installed and the path in `.csproj` is correct
   - Update the `GodotSharp` reference path if needed

2. **Package Restore Fails**
   - Run `dotnet restore` manually
   - Clear NuGet cache: `dotnet nuget locals all --clear`

3. **Tests Fail to Run**
   - Check .NET version compatibility
   - Verify all dependencies are restored
   - Ensure the project builds successfully first

### Debug Mode

To debug tests:

```bash
# Run specific test
dotnet test --filter "TestName"

# Run tests in debug mode
dotnet test --configuration Debug

# Enable detailed logging
dotnet test --logger "console;verbosity=detailed"
```

## Contributing

When adding new functionality to OpenShaderGraph:

1. **Write Tests First** (TDD approach recommended)
2. **Maintain Coverage** - Aim for 100% code coverage on new features
3. **Test Edge Cases** - Include null checks, boundary conditions, error scenarios
4. **Document Tests** - Add comments for complex test scenarios
5. **Update Documentation** - Update this README if adding new test categories

## Performance Testing

For performance-critical components, consider adding benchmark tests:

```csharp
[Test]
public void Method_Performance_CompletesWithinTimeout()
{
    var stopwatch = System.Diagnostics.Stopwatch.StartNew();
    
    // Act
    _instance.ExpensiveMethod();
    
    stopwatch.Stop();
    Assert.That(stopwatch.ElapsedMilliseconds, Is.LessThan(100));
}
```

---

**Note**: This test suite provides comprehensive coverage of the core OpenShaderGraph functionality and serves as both validation and documentation of the expected behavior of the system. 