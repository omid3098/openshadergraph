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
        private FileDialog _fileDialog = default!; // for save dialog
        private Control _rootControl = default!; // root UI scene returned by GetMainScene

        public OpenShaderGraphEditor()
        {
            Logger.Log("[OpenShaderGraphEditor] init");
            // Retrieve shared service instances from the DI container
            _graphManager = Services.Get<GraphManager>();
            _uiManager = Services.Get<UIManager>();
            _preferencesManager = Services.Get<PreferencesManager>();
            _nodeRegistry = Services.Get<NodeRegistry>();

            // Connect GraphManager signals
            _graphManager.GraphSelected += OnGraphSelected;
            _graphManager.GraphDeleted += OnGraphDeleted;

            // Connect UIManager signals
            _uiManager.FileMenuItemSelected += OnFileMenuItemSelected;
            _uiManager.GraphTabSelected += OnGraphTabSelected;
            _uiManager.GraphCloseRequested += OnGraphCloseRequested;
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
        private void OnGraphSelected(BaseGraphData? graph)
        {
            if (graph != null)
            {
                _uiManager.OnGraphSelected(graph);
            }
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

        private void OnGraphCloseRequested(BaseGraphData graph)
        {
            _graphManager.DeleteGraph(graph);
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
                    _fileDialog.FileMode = FileDialog.FileModeEnum.OpenFile;
                    _fileDialog.PopupCentered();
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
            if (_fileDialog.FileMode == FileDialog.FileModeEnum.SaveFile)
            {
                SaveGraphToPath(path);
            }
            else
            {
                LoadGraphFromPath(path);
            }
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
            _fileDialog.FileMode = FileDialog.FileModeEnum.SaveFile;
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
                    ["id"] = node.Id,
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
                        ["type"] = PinDataTypeToString(pin.GetDataType()),
                        ["value"] = pin.GetValue()
                    });
                }

                var outputs = (Godot.Collections.Array)nodeEntry["outputs"];
                foreach (var pin in node.GetOutputs())
                {
                    outputs.Add(new Godot.Collections.Dictionary<string, Variant>
                    {
                        ["name"] = pin.GetName(),
                        ["type"] = PinDataTypeToString(pin.GetDataType()),
                        ["value"] = pin.GetValue()
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
                    ["from_node_id"] = from.NodeId,
                    ["from_pin"] = from.Pin.GetName(),
                    ["to_node_id"] = to.NodeId,
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

        private void LoadGraphFromPath(string path)
        {
            using var file = FileAccess.Open(path, FileAccess.ModeFlags.Read);
            if (file == null)
            {
                Logger.Log($"[OpenShaderGraphEditor] Failed to open graph from {path}");
                return;
            }

            var jsonString = file.GetAsText();
            var json = new Json();
            var error = json.Parse(jsonString);
            if (error != Error.Ok)
            {
                Logger.Log($"[OpenShaderGraphEditor] Failed to parse JSON from {path}: {json.GetErrorMessage()} at line {json.GetErrorLine()}");
                return;
            }

            var data = (Godot.Collections.Dictionary)json.Data;

            // Reconstruct graph from data
            var metadata = (Godot.Collections.Dictionary)data["metadata"];
            var graphName = metadata["name"].ToString();
            var graph = new BaseGraphData(graphName, GraphType.ShaderGraph);
            graph.SetFilePath(path);

            var nodesData = (Godot.Collections.Array)data["nodes"];
            var nodeMap = new Dictionary<long, BaseNodeData>();

            foreach (Godot.Collections.Dictionary nodeEntry in nodesData)
            {
                var nodeName = nodeEntry["name"].ToString();
                var nodeType = nodeEntry["type"].ToString();
                var positionArray = (Godot.Collections.Array)nodeEntry["position"];
                var position = new Vector2((float)positionArray[0], (float)positionArray[1]);

                var inputs = new List<PinData>();
                foreach (Godot.Collections.Dictionary pinEntry in (Godot.Collections.Array)nodeEntry["inputs"])
                {
                    inputs.Add(new PinData(pinEntry["name"].ToString(), StringToPinDataType(pinEntry["type"].ToString()), DirectionType.Input, pinEntry["value"]));
                }

                var outputs = new List<PinData>();
                foreach (Godot.Collections.Dictionary pinEntry in (Godot.Collections.Array)nodeEntry["outputs"])
                {
                    outputs.Add(new PinData(pinEntry["name"].ToString(), StringToPinDataType(pinEntry["type"].ToString()), DirectionType.Output, pinEntry["value"]));
                }

                var nodeData = new BaseNodeData(nodeName, nodeType, position, inputs, outputs);
                if (nodeEntry.ContainsKey("id"))
                {
                    nodeData.Id = (long)nodeEntry["id"];
                }

                graph.AddNode(nodeData);
                nodeMap[nodeData.Id] = nodeData;
            }

            var connectionsData = (Godot.Collections.Array)data["connections"];
            foreach (Godot.Collections.Dictionary connectionEntry in connectionsData)
            {
                var fromNodeId = (long)connectionEntry["from_node_id"];
                var fromPinName = connectionEntry["from_pin"].ToString();
                var toNodeId = (long)connectionEntry["to_node_id"];
                var toPinName = connectionEntry["to_pin"].ToString();

                var fromNode = nodeMap[fromNodeId];
                var toNode = nodeMap[toNodeId];

                var fromPin = fromNode.GetOutputs().Find(p => p.GetName() == fromPinName);
                var toPin = toNode.GetInputs().Find(p => p.GetName() == toPinName);

                if (fromPin != null && toPin != null)
                {
                    var connection = new ConnectionData(fromNode.Id, fromPin, toNode.Id, toPin);
                    graph.AddConnection(connection);
                }
            }

            _graphManager.AddGraph(graph);
            Logger.Log($"[OpenShaderGraphEditor] Loaded graph from {path}");
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

        private static PinDataType StringToPinDataType(string pinDataType)
        {
            return pinDataType switch
            {
                "FLOAT" => PinDataType.Float,
                "FLOAT2" => PinDataType.Vector2,
                "FLOAT3" => PinDataType.Vector3,
                "FLOAT4" => PinDataType.Vector4,
                "INT" => PinDataType.Int,
                "BOOL" => PinDataType.Bool,
                _ => PinDataType.Float
            };
        }
    }
}