# OpenShaderGraph Dev Plan

## Overall Impression

OpenShaderGraph is a thoughtfully designed Godot 4.x plugin with clear layering (Data/Logic/View), strong C# practices, and excellent test coverage on core logic. It currently scores around 7–9 / 10, with major strengths in architecture and extensibility, but room for improvements in performance, error handling, type safety, logging, and documentation/testing.

## 1. Strengths

1. **Clean Layered Architecture**  
   - **Data Layer** (pure C#, testable): `BaseGraphData`, `BaseNodeData`, `PinData`, etc.  
   - **Logic Layer**: Services like `GraphManager`, `GroupingService`, `NodeFilteringService`.  
   - **View Layer**: Godot UI nodes (`BaseGraphNode`, `ShaderGraphEdit`, `OpenShaderGraphEditor`).

2. **Extensibility & Modularity**  
   - Attribute-based node registration (`[RegisterNode]` + `NodeRegistry`).  
   - Base classes (`BaseConstantNode`, `BaseMathNode`) eliminate duplication.  
   - Centralized pin-color management via `PinTypeColors`.

3. **Godot Best Practices**  
   - Typed C# `Action<T>` signals rather than string-based connects.  
   - `#nullable enable` used for null safety.  
   - Godot plugin scaffold (`Plugin.cs`) correctly registers editor UI.

4. **Testing Infrastructure**  
   - Comprehensive NUnit + Moq tests for Data and Logic layers.  
   - Integration tests for core flows.  
   - Clean mocking of Godot via `GodotMocks`.

5. **Service-Locator Pattern**  
   - Simple `Services` container for runtime dependency retrieval.  
   - Works well for small plugin scope.

---

## 2. Areas for Improvement

1. **Performance**  
   - **O(n²) graph redrawing** in `ShaderGraphEdit.DrawGraph` (nested loops).  
   - No caching of node‐view lookups → switch to `Dictionary<long, BaseGraphNode>`.  
   - Excessive logging in hot paths, causing allocations.

2. **Error Handling & Robustness**  
   - Silent failures (e.g. `AddNode(null)` just returns).  
   - No try/catch around critical operations (I/O, service registration).  
   - Memory‐leak risk from unmanaged `Action` delegates with no cleanup.

3. **Dependency Injection & Testability**  
   - Service-locator anti-pattern hides dependencies.  
   - Godot node inheritance for pure logic classes (e.g. `GraphManager`) is unnecessary.  
   - Recommend constructor-based DI or minimal container and a “root” Godot node to own services.

4. **Serialization**  
   - Manual Godot `Dictionary`/`Array` JSON mapping is verbose and brittle.  
   - Already have `Newtonsoft.Json` in tests—leverage it in runtime to simplify save/load.

5. **Type Safety & Code Quality**  
   - `PinData` holds raw `Variant` → lose static typing.  
   - Mixed naming conventions, magic numbers (e.g. offset = 30).  
   - Overuse of `partial` classes and public mutable `Action` fields instead of C# `event`.

6. **Logging**  
   - No log levels or filtering; debug/hot-path logs always on.  
   - Recommend leveled logger (`DEBUG`, `INFO`, `WARN`, `ERROR`) and disable debug in release.

7. **Documentation & Testing Gaps**  
   - Minimal XML comments; no developer guide in `readme.md`.  
   - No UI integration tests for the editor plugin or rendering pipeline.  
   - No performance/load or security tests.

---

# Roadmap to 10/10

We’ll tackle this in three waves—High, Medium, and Low priority—delivering one cohesive feature set at a time.

## Wave 1: High Priority (Core Stability & Performance)

1. **Node-View Caching**  
   - Introduce `Dictionary<long, BaseGraphNode>` in `ShaderGraphEdit`.  
   - Populate on node add/remove (`OnNodeAdded`, `OnNodeRemoved`).  
   - Rewrite `DrawGraph` to O(m + n) instead of O(n·m).

2. **Leveled Logging**  
   - Extend `Logger` with `LogLevel { Debug, Info, Warn, Error }`.  
   - Add global `CurrentLevel` filter.  
   - Wrap hot-path logs with `if (CurrentLevel <= Debug)` and disable by default in release.

3. **Error Handling Hardened**  
   - Audit public APIs for null inputs: throw `ArgumentNullException` instead of silent ignore.  
   - Wrap file I/O (`SaveGraphToPath`, `LoadGraphFromPath`) in `try/catch` + `LogError`.

4. **Memory Cleanup**  
   - Convert public `Action` fields to C# `event`.  
   - Implement `IDisposable` on `BaseGraphNode` to unsubscribe and nullify internally created delegates.

## Wave 2: Medium Priority (Architecture & Developer Experience)

1. **Constructor-Based DI**  
   - Replace `Services.Get<T>()` calls in Logic classes with constructor injection.  
   - Introduce minimal DI container or builder in `PluginRoot` node that owns service lifetimes.

2. **JSON Serialization Overhaul**  
   - Annotate Data classes (`BaseGraphData`, `BaseNodeData`, etc.) with `[JsonProperty]`.  
   - Use `Newtonsoft.Json` for serialization/deserialization in editor plugin.  
   - Remove manual Godot `Dictionary`/`Array` construction.

3. **Typed-Value for PinData**  
   - Refactor `PinData` to use a generic or union type instead of raw `Variant`.  
   - Ensure strong C# typing at compile time.

4. **Configuration Constants & Magic Numbers**  
   - Extract magic numbers (e.g. node-dup offset = 30) into a `Constants` static class.  
   - Centralize default values (`DEFAULT_GRAPH_NAME`, etc.).

5. **Profiling & Performance Tests**  
   - Add simple performance profiling harness.  
   - Write load tests for large graphs, measure redraw times, optimize further if needed.

## Wave 3: Low Priority (Polish & Hardening)

1. **UI Integration Tests**  
   - Use Godot editor testing harness (or headless mode) to assert plugin registration, node creation flows, and rendering triggers.

2. **Documentation & Developer Guide**  
   - Flesh out `readme.md` with architecture overview, DI setup, node-registry instructions.  
   - Add XML docs on public APIs and code examples.

3. **Security & Input Validation**  
   - Validate file paths on save/load to prevent traversal.  
   - Sanitize user inputs (node names, pin names).

4. **Code Cleanup & Consistency**  
   - Remove unnecessary `partial` keywords.  
   - Apply Roslyn analyzers/EditorConfig to enforce naming, `#nullable`, formatting.  
   - Consolidate small partial files where logical.

5. **Additional Quality Gates**  
   - Integrate a static analysis tool (e.g. Sonar, Roslyn analyzers).  
   - Add CI step for performance regression checks.

---

**Next Steps:** pick one Wave 1 task (e.g. caching in `ShaderGraphEdit`) and implement with targeted tests and benchmarks before moving on. Let me know which to tackle first!