using System.Collections.Generic;
using Godot;
using OpenShaderGraph.Core.Data;
using System;

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

        public BaseGroupingNode() : base()
        {
            // Default constructor required for Godot
        }

        public override void Initialize(BaseNodeData nodeData)
        {
            if (nodeData is not GroupNodeData groupNodeData)
            {
                throw new ArgumentException("BaseGroupingNode must be initialized with GroupNodeData");
            }
            base.Initialize(nodeData);
            _graphData = groupNodeData.SubGraph;
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