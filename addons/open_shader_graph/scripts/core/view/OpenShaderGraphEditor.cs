#nullable enable
using Godot;
using System.Collections.Generic;
using System;
using OpenShaderGraph.Core.Data;
using OpenShaderGraph.Core.Logic;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;
using OpenShaderGraph.Core.View.UI.Sidebar.MenuBar;
using OpenShaderGraph.Core.Logic.Services.NodeRegistry;

namespace OpenShaderGraph.Core.View
{
    public partial class OpenShaderGraphEditor : Control
    {
        private readonly IGraphSerializerService _serializerService;
        private GraphManager _graphManager;
        private UIManager _uiManager;
        // private NodeRegistry _nodeRegistry;
        private FileDialog _fileDialog = default!; // for save dialog
        private Control _rootControl = default!; // root UI scene returned by GetMainScene

        public OpenShaderGraphEditor()
        {
            Logger.Log("[OpenShaderGraphEditor] init");
            _serializerService = Services.Get<IGraphSerializerService>();
            // Retrieve shared service instances from the DI container
            _graphManager = Services.Get<GraphManager>();
            _uiManager = Services.Get<UIManager>();
            // Handle graph creation to add a new tab and subscribe to name changes
            _graphManager.GraphCreated += _uiManager.OnGraphCreated;
            // _nodeRegistry = Services.Get<NodeRegistry>();

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
            // Register file filters from the serializer service
            foreach (var (pattern, description) in _serializerService.FileFilters)
            {
                _fileDialog.AddFilter(pattern, description);
            }
            _fileDialog.CurrentFile = _serializerService.DefaultFileName;
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
            graph.SetFilePath(path);

            try
            {
                // Serialize graph to YAML
                if (graph is ShaderGraphData shaderGraph)
                {
                    var yaml = _serializerService.Save(graph);
                    using var file = FileAccess.Open(path, FileAccess.ModeFlags.Write);
                    file.StoreString(yaml);
                    Logger.Info($"[OpenShaderGraphEditor] Graph saved to {path}");
                }
                else
                {
                    Logger.Error("[OpenShaderGraphEditor] Unsupported graph type for YAML serialization.");
                }
            }
            catch (Exception ex)
            {
                Logger.Error($"[OpenShaderGraphEditor] Failed to save graph to {path}: {ex.Message}");
            }
        }

        private void LoadGraphFromPath(string path)
        {
            try
            {
                using var file = FileAccess.Open(path, FileAccess.ModeFlags.Read);
                if (file == null)
                {
                    Logger.Error($"[OpenShaderGraphEditor] Failed to open graph from {path}");
                    return;
                }
                var yamlText = file.GetAsText();
                var graph = _serializerService.Load(yamlText, path);
                _graphManager.AddGraph(graph);
                Logger.Info($"[OpenShaderGraphEditor] Loaded graph from {path}");
            }
            catch (Exception ex)
            {
                Logger.Error($"[OpenShaderGraphEditor] Error loading graph from {path}: {ex.Message}");
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