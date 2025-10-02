import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { persistGet, persistSet } from "@/lib/storage";
import { PanelLeft, Home, Layers, Settings, Sun, Moon } from "lucide-react";
import iconUrl from "../../assets/icon.png";

type AppShellProps = {
  header?: React.ReactNode;
  /** Main content area (fills the space under header, right of sidebar) */
  children: React.ReactNode;
  /** Optional custom sidebar content; when omitted, a default nav is shown. */
  sidebarContent?: React.ReactNode | ((opts: { collapsed: boolean }) => React.ReactNode);
  /** Current theme; when provided, the shell renders the matching icon and delegates toggling. */
  theme?: "dark" | "light";
  /** Invoked when the sidebar theme button is clicked. */
  onToggleTheme?: () => void;
};

export function AppShell({ header, children, sidebarContent, theme, onToggleTheme }: AppShellProps) {
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [localTheme, setLocalTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await persistGet<boolean>("ui.sidebar.collapsed");
      if (!mounted) return;
      if (typeof saved === "boolean") setCollapsed(saved);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (theme !== undefined) return;
    let mounted = true;
    (async () => {
      const saved = await persistGet<string>("ui.theme");
      if (!mounted) return;
      if (saved === "dark" || saved === "light") setLocalTheme(saved);
    })();
    return () => {
      mounted = false;
    };
  }, [theme]);

  useEffect(() => {
    void persistSet("ui.sidebar.collapsed", collapsed);
  }, [collapsed]);

  useEffect(() => {
    if (theme !== undefined) return;
    void persistSet("ui.theme", localTheme);
  }, [localTheme, theme]);

  const themeMode = theme ?? localTheme;
  const isDark = themeMode === "dark";
  const canToggleTheme = typeof onToggleTheme === "function";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", isDark);
  }, [isDark]);

  const handleThemeToggle = useCallback(() => {
    if (canToggleTheme) {
      onToggleTheme?.();
      return;
    }
    setLocalTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, [canToggleTheme, onToggleTheme]);

  const sidebarWidth = collapsed ? 56 : 224; // px

  return (
    <div className="w-screen h-screen flex bg-background text-foreground">
      <aside
        className="h-full border-r bg-card flex flex-col items-stretch transition-[width] duration-200 ease-linear"
        style={{ width: sidebarWidth }}
      >
        <div className={cn("flex items-center gap-2 px-2 py-2 border-b", collapsed && "justify-center")}
        >
          <img src={iconUrl} alt="" className="h-5 w-5 rounded-md" />
          {!collapsed && <span className="text-sm font-semibold transition-opacity duration-200">OpenShaderGraph</span>}
        </div>
        {(typeof sidebarContent === "function" ? sidebarContent({ collapsed }) : sidebarContent) ?? (
          <nav className="flex-1 p-2 space-y-1">
            <SidebarItem icon={<Home className="h-4 w-4" />} label="Dashboard" collapsed={collapsed} />
            <SidebarItem icon={<Layers className="h-4 w-4" />} label="Nodes" collapsed={collapsed} />
            <SidebarItem icon={<Settings className="h-4 w-4" />} label="Settings" collapsed={collapsed} />
          </nav>
        )}
        {/* Bottom toolbar */}
        {!collapsed ? (
          <div className="border-t px-2 py-2 flex items-center justify-start">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Toggle theme"
              onClick={handleThemeToggle}
              title={isDark ? "Switch to light" : "Switch to dark"}
              disabled={!canToggleTheme && typeof document === "undefined"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        ) : null}
      </aside>
      <section className="flex-1 h-full flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-3 py-2 border-b bg-background/80 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
          {header}
        </header>
        <div className="flex-1 min-h-0 relative">{children}</div>
      </section>
    </div>
  );
}

function SidebarItem({ icon, label, collapsed }: { icon: React.ReactNode; label: string; collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-default", collapsed && "justify-center")}
    >
      {icon}
      {!collapsed && <span className="text-sm">{label}</span>}
    </div>
  );
}

export default AppShell;
