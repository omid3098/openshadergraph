using System;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;

namespace OpenShaderGraph.Core.View.NodeViews
{
    public partial class BaseGraphNode : GraphNode
    {
        public Action<BaseNodeData, Vector2> NodeMoved;

        public BaseNodeData Data { get; private set; }

        private static readonly Color DefaultPinColor = new Color(1, 1, 1, 0.8f);

        public BaseGraphNode() : base()
        {
            // Default constructor required for Godot
        }

        public void Initialize(BaseNodeData nodeData)
        {
            Data = nodeData;
            Title = Data.GetName();
            Position = Data.GetPosition();
            FocusMode = Control.FocusModeEnum.All;

            Logger.Log("[BaseGraphNode] Initialize");

            // Connect signals using Godot 4.x C# syntax
            FocusEntered += OnFocusEntered;
            FocusExited += OnFocusExited;
            Dragged += OnDragged;

            // TODO: add pin slots here
        }

        private void OnFocusEntered()
        {
            Logger.Log("[BaseGraphNode] focus_entered");
            // Use built-in focus_entered signal externally to handle node selection
        }

        private void OnFocusExited()
        {
            Logger.Log("[BaseGraphNode] focus_exited");
            // Use built-in focus_exited signal externally to handle node deselection
        }

        private void OnDragged(Vector2 from, Vector2 to)
        {
            Logger.Log($"[BaseGraphNode] dragged from {from} to {to}");
            Position = to;
            if (Data != null)
            {
                Data.SetPosition(to);
            }
            NodeMoved?.Invoke(Data, Position);
            // Use built-in dragged signal externally to handle node movement
        }

        public BaseNodeData GetNodeData()
        {
            return Data;
        }

        public Vector2 GetNodePosition()
        {
            return Position;
        }

        public void SetNodePosition(Vector2 value, bool keepOffset = true)
        {
            Logger.Log($"[BaseGraphNode] set_position called with value: {value}, data_before: {Data?.GetPosition()}");
            Position = value;
            if (Data != null)
            {
                Data.SetPosition(value);
                Logger.Log($"[BaseGraphNode] data position after set_position: {Data.GetPosition()}");
            }
        }

        public string GetNodeTitle()
        {
            return Title;
        }

        public void SetNodeTitle(string value)
        {
            Logger.Log("[BaseGraphNode] set_node_title called");
            Logger.Log($"[BaseGraphNode] set_node_title called with value: {value}, data_before: {Data?.GetName()}");
            Title = value;
            if (Data != null)
            {
                Data.SetName(value);
                Logger.Log($"[BaseGraphNode] data name after set_node_title: {Data.GetName()}");
            }
        }
    }
}