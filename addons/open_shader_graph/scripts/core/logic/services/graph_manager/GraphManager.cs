#nullable enable
using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI;

namespace OpenShaderGraph.Core.Logic.Services.GraphManager
{
    // TODO: GraphManager is better to be responsible for creating and managing graph views and UIManager can have a reference to it to get the current graph view. We also do not have a graphview without a graphdata. so all events in this class can be handled by each graphview. then we can have a list of all available graphviews in this class with one current active graphview.
    public partial class GraphManager : Node, IInitializable, IGraphManager
    {
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

        public GraphView CreateGraph()
        {
            Logger.Log("[GraphManager] Creating graph");
            var graphView = new GraphView("New Graph " + (_graphViews.Count + 1));
            _tabContainer.AddChild(graphView);
            _graphViews.Add(graphView);
            SelectGraph(graphView);
            return graphView;
        }

        public void DeleteGraph(GraphView graph)
        {
            graph.QueueFree();
            _graphViews.Remove(graph);
        }

        public void SelectGraph(GraphView graph)
        {
            foreach (var graphView in _graphViews)
            {
                graphView.Deactivate();
            }
            graph.Activate();
            _currentGraphView = graph;
        }

        public GraphView GetCurrentGraph()
        {
            return _currentGraphView;
        }
    }
}