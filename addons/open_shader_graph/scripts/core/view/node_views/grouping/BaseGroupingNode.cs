using System.Collections.Generic;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.Logic;
using System;

namespace OpenShaderGraph.Core.View.NodeViews.Grouping
{
    public abstract partial class BaseGroupingNode : BaseGraphNode
    {
        // Grouping nodes have a complete GraphData as their data.
        // Grouping nodes are not resizable or closable. they are one single node with input/output pins.
        // Grouping nodes have mandatory input/output nodes.
        // input/output nodes have their pins based on the creation of the grouping node.
        // All types of grouping nodes can be ungrouped and all internal nodes are transfered to the parent graph. except for the input/output nodes. their pins are transfered to the parent graph.
        private GroupGraphData _graphData;

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
            // Listen for double-click to open subgraph
            GuiInput += OnGuiInput;
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

        private void OnGuiInput(InputEvent @event)
        {
            if (@event is InputEventMouseButton mb && mb.ButtonIndex == MouseButton.Left && mb.Pressed && mb.DoubleClick)
            {
                var gm = Services.Get<GraphManager>();
                if (!gm.GetAllGraphs().Contains(_graphData))
                    gm.AddGraph(_graphData);
                else
                    gm.SelectGraph(_graphData);
            }
        }
    }
}