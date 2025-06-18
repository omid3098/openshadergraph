#nullable enable
using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;
using OpenShaderGraph.Core.View.UI.Sidebar.MenuBar;

namespace OpenShaderGraph.Core.View
{
    public partial class OpenShaderGraphEditor : Control
    {
        private GraphManager _graphManager;
        private UIManager _uiManager;
        private PreferencesManager _preferencesManager;
        private NodeRegistry _nodeRegistry;
        private FileDialog _fileDialog; // for save dialog
        private Control _rootControl; // root UI scene returned by GetMainScene

        public OpenShaderGraphEditor()
        {
            Logger.Log("[OpenShaderGraphEditor] init");
            // Retrieve shared service instances from the DI container
            _graphManager = Services.Get<GraphManager>();
            _uiManager = Services.Get<UIManager>();
            _preferencesManager = Services.Get<PreferencesManager>();
            _nodeRegistry = Services.Get<NodeRegistry>();

            // Connect GraphManager signals
            _graphManager.GraphCreated += OnGraphCreated;
            _graphManager.GraphSelected += OnGraphSelected;
            _graphManager.GraphDeleted += OnGraphDeleted;

            // Connect UIManager signals
            _uiManager.FileMenuItemSelected += OnFileMenuItemSelected;
            _uiManager.GraphTabSelected += OnGraphTabSelected;
        }

        public Control GetMainScene()
        {
            Logger.Log("[OpenShaderGraphEditor] get_main_scene");
            _rootControl = _uiManager.GetMainScene();
            // NodeRegistry is now a pure C# service and does not need to be added to the scene
            InitFileDialog();
            return _rootControl;
        }

        // Graph management signal handlers
        private void OnGraphCreated(BaseGraphData graph)
        {
            _uiManager.OnGraphCreated(graph);
        }

        private void OnGraphSelected(BaseGraphData graph)
        {
            _uiManager.OnGraphSelected(graph);
        }

        private void OnGraphDeleted(BaseGraphData graph)
        {
            _uiManager.OnGraphDeleted(graph);
        }

        // UI signal handlers
        private void OnGraphTabSelected(BaseGraphData graph)
        {
            _graphManager.SelectGraph(graph);
        }

        private void OnFileMenuItemSelected(int itemId)
        {
            // Handle actions based on the selected File menu item enum.
            switch ((MenuEnums.FileMenuItem)itemId)
            {
                case MenuEnums.FileMenuItem.NewGraph:
                    Logger.Log("[OpenShaderGraphEditor] File > New Graph");
                    _graphManager.CreateNewGraph();
                    break;
                case MenuEnums.FileMenuItem.OpenGraph:
                    Logger.Log("[OpenShaderGraphEditor] File > Open Graph");
                    break;
                case MenuEnums.FileMenuItem.Save:
                    Logger.Log("[OpenShaderGraphEditor] File > Save");
                    OnSaveMenu();
                    break;
                case MenuEnums.FileMenuItem.SaveAs:
                    Logger.Log("[OpenShaderGraphEditor] File > Save As");
                    OnSaveAsMenu();
                    break;
                case MenuEnums.FileMenuItem.Export:
                    Logger.Log("[OpenShaderGraphEditor] File > Export");
                    break;
                default:
                    Logger.Log($"[OpenShaderGraphEditor] Unknown file menu action: {itemId}");
                    break;
            }
        }

        private void InitFileDialog()
        {
            _fileDialog = new FileDialog();
            _fileDialog.Access = FileDialog.AccessEnum.Resources;
            _fileDialog.FileMode = FileDialog.FileModeEnum.SaveFile;
            _fileDialog.AddFilter("*.json", "JSON Graph");
            _fileDialog.AddFilter("*.yml", "YAML Graph");
            _fileDialog.CurrentFile = "new_graph.json";
            _fileDialog.FileSelected += OnFileDialogFileSelected;
            _rootControl.AddChild(_fileDialog);
        }

        private void OnFileDialogFileSelected(string path)
        {
            SaveGraphToPath(path);
        }

        private void OnSaveMenu()
        {
            var graph = _graphManager.GetCurrentGraph();
            if (graph == null)
            {
                Logger.Log("[OpenShaderGraphEditor] No graph to save.");
                return;
            }
            if (!string.IsNullOrEmpty(graph.GetFilePath()))
            {
                SaveGraphToPath(graph.GetFilePath());
            }
            else
            {
                OnSaveAsMenu();
            }
        }

        private void OnSaveAsMenu()
        {
            _fileDialog.PopupCentered();
        }

        private void SaveGraphToPath(string path)
        {
            var graph = _graphManager.GetCurrentGraph();
            if (graph == null)
            {
                Logger.Log("[OpenShaderGraphEditor] No graph to save.");
                return;
            }

            // Update graph object with chosen file path
            graph.SetFilePath(path);

            // Prepare data structure for serialization
            var data = new Godot.Collections.Dictionary<string, Variant>();

            var metadata = new Godot.Collections.Dictionary<string, Variant>
            {
                ["name"] = graph.GetName(),
                ["version"] = graph.GetVersion(),
                ["type"] = GraphTypeToString(graph.GetGraphType()),
                ["properties"] = new Godot.Collections.Dictionary<string, Variant>(graph.GetProperties())
            };
            data["metadata"] = metadata;

            // Serialize nodes
            var nodesArray = new Godot.Collections.Array();
            foreach (var node in graph.GetNodes())
            {
                var nodeEntry = new Godot.Collections.Dictionary<string, Variant>
                {
                    ["name"] = node.GetName(),
                    ["type"] = node.GetNodeType(),
                    ["position"] = new Godot.Collections.Array { node.GetPosition().X, node.GetPosition().Y },
                    ["inputs"] = new Godot.Collections.Array(),
                    ["outputs"] = new Godot.Collections.Array()
                };

                var inputs = (Godot.Collections.Array)nodeEntry["inputs"];
                foreach (var pin in node.GetInputs())
                {
                    inputs.Add(new Godot.Collections.Dictionary<string, Variant>
                    {
                        ["name"] = pin.GetName(),
                        ["type"] = PinDataTypeToString(pin.GetDataType())
                    });
                }

                var outputs = (Godot.Collections.Array)nodeEntry["outputs"];
                foreach (var pin in node.GetOutputs())
                {
                    outputs.Add(new Godot.Collections.Dictionary<string, Variant>
                    {
                        ["name"] = pin.GetName(),
                        ["type"] = PinDataTypeToString(pin.GetDataType())
                    });
                }

                nodesArray.Add(nodeEntry);
            }
            data["nodes"] = nodesArray;

            // Serialize connections
            var connectionsArray = new Godot.Collections.Array();
            foreach (var connection in graph.GetConnections())
            {
                var from = connection.GetFrom();
                var to = connection.GetTo();
                connectionsArray.Add(new Godot.Collections.Dictionary<string, Variant>
                {
                    ["from_node"] = from.Node.GetName(),
                    ["from_pin"] = from.Pin.GetName(),
                    ["to_node"] = to.Node.GetName(),
                    ["to_pin"] = to.Pin.GetName()
                });
            }
            data["connections"] = connectionsArray;

            // Convert to JSON
            var json = Json.Stringify(data);

            // Write to file
            using var file = FileAccess.Open(path, FileAccess.ModeFlags.Write);
            if (file != null)
            {
                file.StoreString(json);
                Logger.Log($"[OpenShaderGraphEditor] Graph saved to {path}");
            }
            else
            {
                Logger.Log($"[OpenShaderGraphEditor] Failed to save graph to {path}");
            }
        }

        private static string GraphTypeToString(GraphType graphType)
        {
            return graphType switch
            {
                GraphType.ShaderGraph => "SHADER_GRAPH",
                GraphType.GroupGraph => "GROUP_GRAPH",
                GraphType.LocalSubgraph => "LOCAL_SUBGRAPH",
                GraphType.GlobalSubgraph => "GLOBAL_SUBGRAPH",
                _ => "UNKNOWN"
            };
        }

        private static string PinDataTypeToString(PinDataType pinDataType)
        {
            return pinDataType.ToString().ToUpper();
        }
    }
}