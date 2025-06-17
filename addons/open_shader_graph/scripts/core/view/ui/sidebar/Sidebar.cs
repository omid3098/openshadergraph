using Godot;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.UI.Sidebar.MenuBar;

namespace OpenShaderGraph.Core.View.UI.Sidebar
{
    public partial class Sidebar : Control
    {
        // Forward signals from child components
        [Signal]
        public delegate void FileMenuItemSelectedEventHandler(int itemId);

        private CustomMenuBar _customMenuBar;
        private PropertiesPanel _propertiesPanel;

        public Sidebar()
        {
            Logger.Log("[Sidebar] init");

            // Sidebar contents:
            // A custom menu bar to show in this editor, not in the default godot editor. Like the menu bar in the default godot shader editor.
            // Properties Panel (GraphsList removed - using tabs now)

            // Create a VBoxContainer to properly organize the sidebar components vertically
            var vboxContainer = new VBoxContainer();
            vboxContainer.SetAnchorsPreset(Control.LayoutPreset.FullRect);
            AddChild(vboxContainer);

            _customMenuBar = new CustomMenuBar();
            _propertiesPanel = new PropertiesPanel();

            // Connect menu bar signals to forward them
            _customMenuBar.FileMenuItemSelected += OnFileMenuItemSelected;

            // Set size flags for proper layout
            _customMenuBar.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            _customMenuBar.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;

            _propertiesPanel.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            _propertiesPanel.SizeFlagsVertical = Control.SizeFlags.ExpandFill;

            // Add components directly to VBox (no split container needed with only 2 components)
            vboxContainer.AddChild(_customMenuBar);
            vboxContainer.AddChild(_propertiesPanel);
        }

        private void OnFileMenuItemSelected(int itemId)
        {
            // Forward signal to parent
            EmitSignal(SignalName.FileMenuItemSelected, itemId);
        }
    }
}