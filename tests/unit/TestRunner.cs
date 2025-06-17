using System;

namespace OpenShaderGraph.Tests
{
    public static class TestRunner
    {
        public static void RunAllTests()
        {
            Console.WriteLine("=== OpenShaderGraph C# Unit Tests ===");
            Console.WriteLine();
            Console.WriteLine("Use 'dotnet test' command to run the test suite.");
            Console.WriteLine("This provides comprehensive test execution with detailed reporting.");
            Console.WriteLine();
            Console.WriteLine("Available test commands:");
            Console.WriteLine("  dotnet test                     - Run all tests");
            Console.WriteLine("  dotnet test --verbosity normal  - Run with detailed output");
            Console.WriteLine("  dotnet test --filter 'TestName' - Run specific test");
            Console.WriteLine();
            Console.WriteLine("=== Test Runner Information ===");
        }
    }
}