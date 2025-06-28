#nullable enable

using System;
using System.Collections.Generic;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Utils
{
    /// <summary>
    /// Service interface for serializing and deserializing graph assets.
    /// Allows pluggable formats (YAML, JSON, etc.).
    /// </summary>
    public interface IGraphSerializerService
    {
        /// <summary>File patterns and descriptions to register in the file dialog (e.g. "*.yml", "YAML Graph").</summary>
        IEnumerable<(string pattern, string description)> FileFilters { get; }

        /// <summary>Default file name to use when creating a new graph (e.g. "new_graph.yml").</summary>
        string DefaultFileName { get; }

        /// <summary>Serialize the given graph to a string (file content).</summary>
        string Save(GraphData graph);

        /// <summary>Deserialize graph content to a graph object, setting file path if provided.</summary>
        GraphData Load(string content, string? filePath = null);
    }
}