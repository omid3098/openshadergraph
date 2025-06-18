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
        private Dictionary<string, List<RegisteredNode>> _registeredNodes = new();
        private Vector2 _creationPositionInGraph;

        public Action<string, Vector2> NodeCreationRequested;

        public override void _Ready()
        {
            HideOnItemSelection = false;
            IdPressed += OnIdPressed;
            AboutToPopup += OnAboutToPopup;
            SizeChanged += PositionSearchBox;

            _searchBox = new LineEdit { PlaceholderText = "Search..." };
            AddChild(_searchBox);
            _searchBox.TextChanged += OnSearchTextChanged;

            _registeredNodes = Services.Get<NodeRegistry>().GetRegisteredNodes();
        }

        private void OnAboutToPopup()
        {
            // Repopulate menu each time it's shown to ensure it's fresh.
            PopulateMenu(_searchBox.Text);

            // Defer positioning to allow the popup to calculate its size.
            Callable.From(PositionSearchBox).CallDeferred();

            _searchBox.GrabFocus();
            _searchBox.SelectAll();
        }

        public void ShowMenu(Vector2 globalPosition, Vector2 localPosition)
        {
            _creationPositionInGraph = localPosition;
            Position = (Vector2I)globalPosition;
            Popup();
        }

        private void PositionSearchBox()
        {
            if (ItemCount == 0)
            {
                return;
            }

            var panelStyle = GetThemeStylebox("panel");
            if (panelStyle == null) return;

            var leftMargin = panelStyle.GetContentMargin(Side.Left);
            var topMargin = panelStyle.GetContentMargin(Side.Top);
            var rightMargin = panelStyle.GetContentMargin(Side.Right);

            _searchBox.Position = new Vector2(leftMargin, topMargin);
            _searchBox.Size = new Vector2(Size.X - leftMargin - rightMargin, 0); // Height will be set next

            var font = GetThemeFont("font");
            var fontSize = GetThemeFontSize("font_size");
            var fontHeight = font.GetHeight(fontSize);

            var searchBoxStyle = new StyleBoxFlat
            {
                BgColor = GetThemeColor("dark_color_2", "Editor"),
                ContentMarginLeft = 4,
                ContentMarginRight = 4,
                ContentMarginTop = 4,
                ContentMarginBottom = 4,
                BorderWidthBottom = 2,
                BorderColor = GetThemeColor("dark_color_1", "Editor")
            };
            _searchBox.AddThemeStyleboxOverride("normal", searchBoxStyle);
            _searchBox.Size = new Vector2(_searchBox.Size.X, fontHeight + searchBoxStyle.GetMinimumSize().Y);
        }

        private void PopulateMenu(string searchText = "")
        {
            searchText = searchText.Trim().ToLower();

            Clear();
            foreach (var sub in _subMenus.Values)
            {
                sub.QueueFree();
            }
            _subMenus.Clear();

            // This placeholder item reserves space for the search box.
            // It is covered by the search box, which gets a proper background.
            AddItem("");
            SetItemDisabled(0, true);

            if (string.IsNullOrEmpty(searchText))
            {
                foreach (string category in _registeredNodes.Keys)
                {
                    var subMenu = new PopupMenu();
                    subMenu.Name = category + " > ";
                    AddSubmenuNodeItem(category, subMenu);
                    _subMenus[category] = subMenu;
                    foreach (var node in _registeredNodes[category])
                    {
                        subMenu.AddItem(node.Attribute.Name);
                        subMenu.IdPressed += (id) => OnSubMenuIdPressed(subMenu, id);
                    }
                }
            }
            else
            {
                foreach (var category in _registeredNodes.Keys)
                {
                    foreach (var node in _registeredNodes[category])
                    {
                        if (node.Attribute.Name.ToLower().Contains(searchText) || category.ToLower().Contains(searchText))
                        {
                            var itemText = $"{category} > {node.Attribute.Name}";
                            AddItem(itemText);
                        }
                    }
                }
            }
        }

        private void OnSubMenuIdPressed(PopupMenu menu, long id)
        {
            var nodeName = menu.GetItemText((int)id);
            NodeCreationRequested?.Invoke(nodeName, _creationPositionInGraph);
            Hide();
        }


        private void OnSearchTextChanged(string newText)
        {
            PopulateMenu(newText);
        }

        private void OnIdPressed(long id)
        {
            var searchText = _searchBox.Text.Trim();
            if (!string.IsNullOrEmpty(searchText))
            {
                if (id >= ItemCount || id < 1) return; // item 0 is placeholder
                var itemText = GetItemText((int)id);
                if (string.IsNullOrEmpty(itemText)) return;

                var parts = itemText.Split(" > ");
                if (parts.Length > 1)
                {
                    var nodeName = parts[1];
                    NodeCreationRequested?.Invoke(nodeName, _creationPositionInGraph);
                    Hide();
                }
            }
        }
    }
}