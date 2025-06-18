using Godot;
using OpenShaderGraph.Core.Utils;
using OpenShaderGraph.Core.View.NodeViews;
using System;
using System.Collections.Generic;

namespace OpenShaderGraph.Core.View.UI.ContextMenu
{
    public partial class CreationPopup : PopupMenu
    {
        private LineEdit _searchBox;
        private Dictionary<string, PopupMenu> _subMenus = new();

        public Action<string, Vector2> NodeCreationRequested;

        public CreationPopup()
        {
            // Constructor should do minimal work.
            // Defer population until _Ready.
            HideOnItemSelection = false;
            IdPressed += OnIdPressed;
        }

        public override void _Ready()
        {
            base._Ready();

            // Search box setup
            _searchBox = new LineEdit { PlaceholderText = "Search..." };
            AddChild(_searchBox);
            _searchBox.TextChanged += OnSearchTextChanged;

            PopulateMenu();
        }

        public void ShowMenu(Vector2 position)
        {
            Position = (Vector2I)position;
            Popup();
            _searchBox.GrabFocus();
        }

        private void PopulateMenu()
        {
            // Clear everything except the search box
            while (ItemCount > 1)
            {
                RemoveItem(1);
            }
            foreach (var child in GetChildren())
            {
                if (child is PopupMenu)
                {
                    child.QueueFree();
                }
            }
            _subMenus.Clear();


            var registeredNodes = NodeRegistry.Instance.GetRegisteredNodes();

            foreach (var category in registeredNodes.Keys)
            {
                var subMenu = new PopupMenu();
                subMenu.Name = category + "SubMenu";
                AddSubmenuItem(category, subMenu.Name);
                AddChild(subMenu);
                _subMenus[category] = subMenu;

                foreach (var node in registeredNodes[category])
                {
                    subMenu.AddItem(node.Attribute.Name);
                    subMenu.IdPressed += (id) => OnSubMenuIdPressed(subMenu, id);
                }
            }
        }

        private void OnSubMenuIdPressed(PopupMenu menu, long id)
        {
            var nodeName = menu.GetItemText((int)id);
            NodeCreationRequested?.Invoke(nodeName, Position);
            Hide();
        }


        private void OnSearchTextChanged(string newText)
        {
            var searchText = newText.Trim().ToLower();

            // Clear everything except the search box itself
            while (ItemCount > 1)
            {
                RemoveItem(1);
            }
            foreach (var child in GetChildren())
            {
                if (child is PopupMenu)
                {
                    RemoveChild(child);
                    child.QueueFree();
                }
            }
            _subMenus.Clear();

            var registeredNodes = NodeRegistry.Instance.GetRegisteredNodes();

            if (string.IsNullOrEmpty(searchText))
            {
                // If search is cleared, repopulate the full menu
                PopulateMenu();
            }
            else
            {
                // Re-add search box if it was removed
                if (_searchBox.GetParent() == null)
                {
                    AddChild(_searchBox);
                }

                // If there is search text, show a flat list
                foreach (var category in registeredNodes.Keys)
                {
                    foreach (var node in registeredNodes[category])
                    {
                        var itemText = $"{node.Attribute.Category} > {node.Attribute.Name}";
                        if (itemText.ToLower().Contains(searchText))
                        {
                            AddItem(itemText);
                        }
                    }
                }
            }
        }

        private void OnIdPressed(long id)
        {
            var searchText = _searchBox.Text.Trim();
            if (!string.IsNullOrEmpty(searchText))
            {
                if (id >= ItemCount || id < 0) return;
                var itemText = GetItemText((int)id);
                if (string.IsNullOrEmpty(itemText)) return;

                // Extract node name from "Category > Node Name"
                var parts = itemText.Split(" > ");
                if (parts.Length > 1)
                {
                    var nodeName = parts[1];
                    NodeCreationRequested?.Invoke(nodeName, Position);
                    Hide();
                }
            }
        }
    }
}