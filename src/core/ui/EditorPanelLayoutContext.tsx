import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { EditorPanelKey } from "./editorNodes";

export type EditorPanelLayout = {
  pinned: boolean;
  viewportX: number;
  viewportY: number;
};

export type EditorPanelLayoutPatch =
  | Partial<EditorPanelLayout>
  | ((previous: EditorPanelLayout | undefined) => Partial<EditorPanelLayout> | undefined);

type EditorPanelLayoutContextValue = {
  layouts: Partial<Record<EditorPanelKey, EditorPanelLayout>>;
  updateLayout: (panel: EditorPanelKey, patch: EditorPanelLayoutPatch | null) => void;
};

const EditorPanelLayoutContext = createContext<EditorPanelLayoutContextValue | null>(null);

export function EditorPanelLayoutProvider({
  value,
  children,
}: {
  value: EditorPanelLayoutContextValue;
  children: ReactNode;
}) {
  return <EditorPanelLayoutContext.Provider value={value}>{children}</EditorPanelLayoutContext.Provider>;
}

export function useEditorPanelLayout(panel?: EditorPanelKey) {
  const ctx = useContext(EditorPanelLayoutContext);
  const layout = panel && ctx ? ctx.layouts[panel] : undefined;
  const updateLayout = useCallback(
    (patch: EditorPanelLayoutPatch | null) => {
      if (!panel || !ctx) return;
      ctx.updateLayout(panel, patch);
    },
    [ctx, panel]
  );
  return { layout, updateLayout } as const;
}
