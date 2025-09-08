export interface LifecycleContext<Examples = unknown, GraphData = unknown, Code = string, Preview = unknown> {
  examples?: Examples;
  graph?: GraphData;
  code?: Code;
  preview?: Preview;
}

export interface AppLifecycleHooks<Examples = unknown, GraphData = unknown, Code = string, Preview = unknown> {
  /** Initialize application windows or UI containers. */
  initializeWindows?: (ctx: LifecycleContext<Examples, GraphData, Code, Preview>) => Promise<void> | void;
  /** Load example graphs from disk or remote endpoint. */
  loadExampleGraphs: (ctx: LifecycleContext<Examples, GraphData, Code, Preview>) => Promise<Examples>;
  /** Convert the loaded examples into canonical graph data. */
  provideGraphData: (ctx: LifecycleContext<Examples, GraphData, Code, Preview>) => Promise<GraphData> | GraphData;
  /** Compile the graph data into a GLSL shader source. */
  compileGraph: (ctx: LifecycleContext<Examples, GraphData, Code, Preview>) => Promise<Code>;
  /** Update the preview panel using the compiled GLSL code. */
  updatePreview: (ctx: LifecycleContext<Examples, GraphData, Code, Preview>) => Promise<Preview>;
}
