#nullable enable
using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI;
using System;
using OpenShaderGraph.Core.Data;

namespace OpenShaderGraph.Core.Logic.Services.GraphManager
{
    public partial class GraphManager : Node, IInitializable, IGraphManager
    {
        public event Action<GraphView> GraphSelected;
        public event Action<GraphView> GraphDeleted;
        public event Action<GraphView> GraphCreated;
        public event Action<GraphView> GraphNameChanged;
        private List<GraphView> _graphViews;
        private GraphView _currentGraphView;
        private TabContainer _tabContainer;
        public void Init()
        {
            Logger.Log("[GraphManager] init");
            _graphViews = new List<GraphView>();
        }

        public void SetTabContainer(TabContainer tabContainer)
        {
            _tabContainer = tabContainer;
            AddListeners();
        }

        void AddListeners()
        {
            _tabContainer.TabChanged += OnTabChanged;
            // _tabContainer.GetTabBar().TabClosePressed += OnTabCloseRequested;
            // _tabContainer.GetTabBar().GuiInput += OnTabBarGuiInput;
        }
        void RemoveListeners()
        {
            _tabContainer.TabChanged -= OnTabChanged;
            // _tabContainer.GetTabBar().TabClosePressed -= OnTabCloseRequested;
            // _tabContainer.GetTabBar().GuiInput -= OnTabBarGuiInput;
        }

        private void OnTabChanged(long tabIndex)
        {
            var child = _tabContainer.GetChild((int)tabIndex);
            if (child is GraphView graphView)
            {
                SelectGraph(graphView);
            }
        }

        private void OnTabBarGuiInput(InputEvent @event)
        {
            if (@event is InputEventMouseButton mouseButton && mouseButton.Pressed && mouseButton.ButtonIndex == MouseButton.Middle)
            {
                var tabBar = _tabContainer.GetTabBar();
                if (tabBar == null)
                {
                    return;
                }

                for (int i = 0; i < tabBar.GetTabCount(); i++)
                {
                    if (tabBar.GetTabRect(i).HasPoint(mouseButton.Position))
                    {
                        OnTabCloseRequested(i);
                        break;
                    }
                }
            }
        }

        private void OnTabCloseRequested(long tabIndex)
        {
            if (_tabContainer.GetTabControl((int)tabIndex) is GraphView graphView)
            {
                DeleteGraph(graphView);
            }
        }

        public GraphView CreateGraph(ShaderType shaderType)
        {
            Logger.Log("[GraphManager] Creating graph");
            var graphView = new GraphView("New " + shaderType.ToString() + (_graphViews.Count + 1), shaderType);
            _tabContainer.AddChild(graphView);
            _graphViews.Add(graphView);
            SelectGraph(graphView);
            GraphCreated?.Invoke(graphView);
            return graphView;
        }

        public void DeleteGraph(GraphView graph)
        {
            graph.QueueFree();
            _graphViews.Remove(graph);
            GraphDeleted?.Invoke(graph);
        }

        public void SelectGraph(GraphView graph)
        {
            foreach (var graphView in _graphViews)
            {
                graphView.Deactivate();
            }
            graph.Activate();
            _currentGraphView = graph;
            GraphSelected?.Invoke(graph);
        }

        public GraphView GetCurrentGraph()
        {
            return _currentGraphView;
        }

        public void SetCurrentGraphName(string name)
        {
            _currentGraphView.SetName(name);
            GraphNameChanged?.Invoke(_currentGraphView);
        }
    }
}