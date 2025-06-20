using System.Collections.Generic;
using Godot;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.View.NodeViews.Grouping
{
    public abstract partial class BaseGroupingNode : BaseGraphNode
    {
        // Grouping nodes have a complete BaseGraphData as their data.
        // Grouping nodes are not resizable or closable. they are one single node with input/output pins.
        // Grouping nodes have mandatory input/output nodes.
        // input/output nodes have their pins based on the creation of the grouping node.
        // All types of grouping nodes can be ungrouped and all internal nodes are transfered to the parent graph. except for the input/output nodes. their pins are transfered to the parent graph.
        private BaseGroupGraphData _graphData;

        public BaseGroupingNode(GraphType graphType) : base()
        {
            // Default constructor required for Godot
            var _name = "";
            switch (graphType)
            {
                case GraphType.GroupGraph:
                    _name = "Group";
                    break;
                case GraphType.LocalSubgraph:
                    _name = "Local Subgraph";
                    break;
                case GraphType.GlobalSubgraph:
                    _name = "Subgraph";
                    break;
            }
            _graphData = new BaseGroupGraphData(_name, graphType);
        }
        public void AddNodesAndConnections(List<BaseNodeData> nodes, List<ConnectionData> connections)
        {
            foreach (var node in nodes)
            {
                _graphData.AddNode(node);
            }
            foreach (var connection in connections)
            {
                _graphData.AddConnection(connection);
            }
        }
    }
}