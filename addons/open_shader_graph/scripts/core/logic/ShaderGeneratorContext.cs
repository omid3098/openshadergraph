using System.Collections.Generic;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Logic
{
    /// <summary>
    /// Context for accumulating shader code generation state, including variable naming and code sections.
    /// </summary>
    public class ShaderGeneratorContext
    {
        private readonly Dictionary<long, string> _variableNames = new();
        private int _nextVarId = 0;

        private readonly List<string> _helperFunctions = new();
        private readonly List<string> _bodyLines = new();

        /// <summary>
        /// Helper functions (multi-line) collected during generation.
        /// </summary>
        public IReadOnlyList<string> HelperFunctions => _helperFunctions;

        /// <summary>
        /// Main body code lines for the shader stage.
        /// </summary>
        public IReadOnlyList<string> BodyLines => _bodyLines;

        /// <summary>
        /// Gets or assigns a unique variable name for the given node.
        /// </summary>
        public string GetVariableName(BaseNodeData node)
        {
            if (!_variableNames.TryGetValue(node.Id, out var name))
            {
                name = $"var{_nextVarId++}";
                _variableNames[node.Id] = name;
            }
            return name;
        }

        /// <summary>
        /// Adds a helper function snippet to the context.
        /// </summary>
        public void AddHelperFunction(string functionCode) => _helperFunctions.Add(functionCode);

        /// <summary>
        /// Adds a line of code to the body section.
        /// </summary>
        public void AddBodyLine(string line) => _bodyLines.Add(line);
    }
}