import { createContext, useContext, type ReactNode } from "react";

export type ThemeName = "dark" | "light";

export type CurveMode = "default" | "smoothstep" | "step" | "straight" | "simplebezier";

type SettingsContextValue = {
  theme: ThemeName;
  setTheme: (next: ThemeName) => void;
  curveMode: CurveMode;
  setCurveMode: (next: CurveMode) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ value, children }: { value: SettingsContextValue; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
