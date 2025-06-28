using System;
using Godot;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.Utils;

namespace OpenShaderGraph.Core.View.NodeViews
{
    // TODO: The correct name should be NodeView
    public abstract partial class BaseGraphNode : GraphNode
    {

        public long Id { get; set; } = -1;
        public readonly NodeTemplate Template;

        public Action<BaseNodeData, Vector2>? NodeMoved;

        public BaseNodeData Data { get; private set; }

        private static readonly Color DefaultPinColor = new Color(1, 1, 1, 0.8f);

        public static BaseNodeData CreateNodeData(NodeTemplate template, Vector2 position)
        {
            return new BaseNodeData(template, position);
        }

        public BaseGraphNode() : base()
        {
            // Default constructor required for Godot
        }

        public virtual void Initialize(BaseNodeData nodeData)
        {
            Data = nodeData;
            Title = Data.GetTitle();
            PositionOffset = Data.GetPosition();
            FocusMode = Control.FocusModeEnum.All;

            Logger.Log("[BaseGraphNode] Initialize");

            // Connect signals using Godot 4.x C# syntax
            FocusEntered += OnFocusEntered;
            FocusExited += OnFocusExited;
            Dragged += OnDragged;

            DrawPins();
        }

        private void DrawPins()
        {
            ClearAllSlots();
            int slotIndex = 0;

            foreach (var pin in Data.GetInputs())
            {
                var label = new Label { Text = pin.GetName() };
                AddChild(label);
                var color = PinTypeColors.GetColorForType(pin.GetDataType());
                SetSlot(slotIndex, true, (int)pin.GetDataType(), color, false, 0, Colors.Transparent);
                slotIndex++;
            }

            foreach (var pin in Data.GetOutputs())
            {
                var label = new Label { Text = pin.GetName(), HorizontalAlignment = HorizontalAlignment.Right };
                AddChild(label);
                var color = PinTypeColors.GetColorForType(pin.GetDataType());
                SetSlot(slotIndex, false, 0, Colors.Transparent, true, (int)pin.GetDataType(), color);
                slotIndex++;
            }
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
            if (Data != null)
            {
                Data.SetPosition(PositionOffset);
            }
            NodeMoved?.Invoke(Data, PositionOffset);
            // Use built-in dragged signal externally to handle node movement
        }

        public BaseNodeData GetNodeData()
        {
            return Data;
        }

        public Vector2 GetNodePosition()
        {
            return PositionOffset;
        }

        public void SetNodePosition(Vector2 value, bool keepOffset = true)
        {
            Logger.Log($"[BaseGraphNode] set_position called with value: {value}, data_before: {Data?.GetPosition()}");
            PositionOffset = value;
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
            Logger.Log($"[BaseGraphNode] set_node_title called with value: {value}, data_before: {Data?.GetTitle()}");
            Title = value;
            if (Data != null)
            {
                // Data.SetName(value);
                Logger.Log($"[BaseGraphNode] data name after set_node_title: {Data.GetTitle()}");
            }
        }

        public void DeleteNode()
        {
            Logger.Log($"[BaseGraphNode] DeleteNode invoked for {Data.GetTitle()}({Data.Id})");
            // Unsubscribe Godot signals
            FocusEntered -= OnFocusEntered;
            FocusExited -= OnFocusExited;
            Dragged -= OnDragged;
            // Clear custom delegates
            NodeMoved = null;
            // Queue free in Godot; let engine and GC handle cleanup
            QueueFree();
        }
    }
}