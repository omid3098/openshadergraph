using Godot;
using System.Collections.Generic;
using OpenShaderGraph.Core.Utils;
using System;

namespace OpenShaderGraph.Core.View.UI.Sidebar.MenuBar
{
    public partial class CustomMenuBar : PanelContainer
    {
        // Direct signal for parent communication
        public Action<int> FileMenuItemSelected;

        private Dictionary<string, MenuData> _menus = new();
        // Internal HBoxContainer that actually hosts the menu buttons. Using a PanelContainer
        // as the root node lets us style the background via a StyleBox without manually drawing.
        private HBoxContainer _hbox;

        private struct MenuData
        {
            public Button Button;
            public PopupMenu Popup;
        }

        public CustomMenuBar()
        {
            Logger.Log("[CustomMenuBar] init");

            // Create the internal HBoxContainer that will hold the menu buttons.
            _hbox = new HBoxContainer();
            _hbox.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            _hbox.SizeFlagsVertical = Control.SizeFlags.ShrinkCenter;
            AddChild(_hbox);

            SetupStyling();
            SetupDefaultMenus();
        }

        private void SetupDefaultMenus()
        {
            // Only File menu is required for now
            AddFileMenu();
        }

        private void SetupStyling()
        {
            // Create a StyleBoxFlat to serve as the dark background for the menu bar.
            var stylebox = new StyleBoxFlat();
            stylebox.BgColor = new Color(0.13f, 0.13f, 0.13f, 1f); // Darker background colour
            // Optional: Give rounded corners
            stylebox.SetCornerRadiusAll(6);

            AddThemeStyleboxOverride("panel", stylebox);
        }

        public void AddMenu(string menuName, MenuItemData[] items)
        {
            /*
            Add a menu to the menu bar
            menuName: The display name for the menu button
            items: Array of MenuItemData with Text, Id, Disabled (optional), Separator (optional)
            */
            if (_menus.ContainsKey(menuName))
            {
                GD.PushWarning($"[CustomMenuBar] Menu '{menuName}' already exists, replacing it");
                RemoveMenu(menuName);
            }

            // Create the menu button
            var menuButton = new Button();
            menuButton.Text = menuName;
            menuButton.Flat = true;
            menuButton.CustomMinimumSize = new Vector2(60, 0);
            menuButton.SizeFlagsHorizontal = Control.SizeFlags.ShrinkCenter;

            // Create the popup menu
            var popupMenu = new PopupMenu();
            popupMenu.Name = menuName + "_popup";

            // Add items to the popup menu
            foreach (var item in items)
            {
                if (item.Separator)
                {
                    popupMenu.AddSeparator();
                }
                else
                {
                    var itemId = item.Id ?? popupMenu.ItemCount;
                    popupMenu.AddItem(item.Text, itemId);
                    if (item.Disabled)
                    {
                        popupMenu.SetItemDisabled(popupMenu.ItemCount - 1, true);
                    }
                }
            }

            // Connect signals
            menuButton.Pressed += () => OnMenuButtonPressed(menuName);
            popupMenu.IdPressed += (itemId) => OnPopupItemSelected((int)itemId, menuName);

            // Add to internal HBoxContainer so layout remains horizontal
            _hbox.AddChild(menuButton);
            menuButton.AddChild(popupMenu);

            // Store reference
            _menus[menuName] = new MenuData
            {
                Button = menuButton,
                Popup = popupMenu
            };
        }

        public void RemoveMenu(string menuName)
        {
            if (_menus.ContainsKey(menuName))
            {
                var menuData = _menus[menuName];
                menuData.Button.QueueFree();
                _menus.Remove(menuName);
            }
        }

        public PopupMenu GetMenu(string menuName)
        {
            if (_menus.ContainsKey(menuName))
            {
                return _menus[menuName].Popup;
            }
            return null;
        }

        public void UpdateMenuItem(string menuName, int itemId, string newText = "", bool disabled = false)
        {
            var popup = GetMenu(menuName);
            if (popup != null)
            {
                var itemIndex = popup.GetItemIndex(itemId);
                if (itemIndex != -1)
                {
                    if (!string.IsNullOrEmpty(newText))
                    {
                        popup.SetItemText(itemIndex, newText);
                    }
                    popup.SetItemDisabled(itemIndex, disabled);
                }
            }
        }

        private void OnMenuButtonPressed(string menuName)
        {
            if (_menus.TryGetValue(menuName, out var menuData))
            {
                var button = menuData.Button;
                var popup = menuData.Popup;

                // Position the popup below the button
                var buttonGlobalPos = button.GlobalPosition;
                var buttonSize = button.Size;
                popup.Position = new Vector2I((int)buttonGlobalPos.X, (int)(buttonGlobalPos.Y + buttonSize.Y));
                popup.Popup();
            }
        }

        private void OnPopupItemSelected(int itemId, string menuName)
        {
            // Emit signal to parent instead of using EventBus
            FileMenuItemSelected?.Invoke(itemId);
        }

        // Convenience methods for common menu operations
        public void AddFileMenu()
        {
            var fileItems = new MenuItemData[]
            {
                new() { Text = "New Graph", Id = (int)MenuEnums.FileMenuItem.NewGraph },
                new() { Text = "Open Graph", Id = (int)MenuEnums.FileMenuItem.OpenGraph },
                new() { Separator = true },
                new() { Text = "Save", Id = (int)MenuEnums.FileMenuItem.Save },
                new() { Text = "Save As", Id = (int)MenuEnums.FileMenuItem.SaveAs },
                new() { Separator = true },
                new() { Text = "Export", Id = (int)MenuEnums.FileMenuItem.Export }
            };
            AddMenu("File", fileItems);
        }

        public struct MenuItemData
        {
            public string Text;
            public int? Id;
            public bool Disabled;
            public bool Separator;
        }
    }
}