import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { cn } from "@/lib/utils";
import { isAbortError } from "@/lib/errors";
import { isCompilableGraph } from "@/core/io/guards";
import { Check, Copy } from "lucide-react";
import CodeBlock from "./CodeBlock";

type CompilePanelProps = {
  graph: unknown;
  className?: string;
  variant?: "overlay" | "docked" | "node";
};

type LanguageItem = { key: string; name: string; path: string };

const getPrismLang = (key: string): string => {
  const lower = key.toLowerCase();
  if (lower.includes("json")) return "json";
  if (lower.includes("glsl")) return "clike";
  if (lower.includes("wgsl")) return "clike";
  if (lower.includes("metal")) return "clike";
  return "clike";
};

export function CompilePanel({ graph, className, variant = "overlay" }: CompilePanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    const stored = typeof localStorage !== "undefined" ? Number(localStorage.getItem("compilePanel.width")) : 0;
    return Number.isFinite(stored) && stored > 240 ? stored : 520;
  });
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [language, setLanguage] = useState<string>(() => {
    if (typeof localStorage !== "undefined") return localStorage.getItem("compilePanel.language") ?? "ThreeJS_GLSL";
    return "ThreeJS_GLSL";
  });
  const [engine, setEngine] = useState<string>(() => {
    if (typeof localStorage !== "undefined") return localStorage.getItem("compilePanel.engine") ?? "default";
    return "default";
  });
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [working, setWorking] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("compilePanel.width", String(width));
    }
  }, [width]);

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        let list: LanguageItem[] | null = null;
        try {
          const res = await fetch("/api/languages", { signal: abort.signal });
          if (res.ok) {
            const data = await res.json();
            list = Array.isArray(data.languages) ? data.languages : [];
          }
        } catch {}
        if (!list) {
          const res2 = await fetch("/data/languages.index.json", { signal: abort.signal });
          if (res2.ok) {
            const data2 = await res2.json();
            list = Array.isArray(data2.languages) ? data2.languages : [];
          }
        }
        if (!list) list = [];
        setLanguages(list);
        setLanguage((prev) => {
          if (prev && prev.length) return prev;
          const preferred = list!.find((l) => l.key === "ThreeJS_GLSL");
          return preferred?.key ?? (list![0]?.key ?? prev);
        });
      } catch (err: any) {
        if (isAbortError(err)) return;
        console.warn("Failed to fetch languages", err);
      }
    })();
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("compilePanel.language", language);
  }, [language]);
  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem("compilePanel.engine", engine);
  }, [engine]);

  const stableGraph = useMemo(() => {
    try {
      return JSON.parse(JSON.stringify(graph ?? {}));
    } catch {
      return {} as any;
    }
  }, [graph]);

  // Trigger compile on graph/language/engine changes with debounce + cancellation
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const abort = new AbortController();
    let cancelled = false;
    debounceRef.current = window.setTimeout(() => {
      (async () => {
        try {
          setWorking(true);
          setError("");
          const canCompile = isCompilableGraph(stableGraph as any);
          if (!canCompile) {
            setCode("");
            return;
          }
          // Prefer API; fallback to client-side compile if available
          let outCode: string | null = null;
          try {
            const res = await fetch("/api/compile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: abort.signal,
              body: JSON.stringify({ graph: stableGraph, language, engine }),
            });
            if (res.ok) {
              const data = await res.json();
              outCode = String(data.code ?? "");
            }
          } catch {}
          if (outCode == null) {
            // Client-side compile fallback using static language pack
            const langFile = language.endsWith(".json") ? language : `${language}.json`;
            const res2 = await fetch(`/data/languages/${langFile}`, { signal: abort.signal } as any);
            if (!res2.ok) throw new Error(`Failed to load language: ${res2.status}`);
            const langJson = await res2.json();
            const { validateLanguagePack } = await import("@/core/schema/validators");
            const { GraphCompiler } = await import("@/core/compiler/graphCompiler");
            const { loadAllTemplatesForBrowser } = await import("@/core/schema/registry");
            const langPack = validateLanguagePack(langJson);
            await loadAllTemplatesForBrowser();
            const compiler = new GraphCompiler(stableGraph as any, langPack);
            compiler.compile();
            outCode = compiler.result_code;
          }
          if (cancelled) return;
          setCode(outCode);
        } catch (err: any) {
          if (cancelled) return;
          if (isAbortError(err)) return;
          const rawMsg = typeof err?.stack === "string" ? err.stack : (typeof err?.message === "string" ? err.message : "Compile failed");
          console.error("[compile-panel] compile error", err);
          const firstLine = String(rawMsg).split("\n")[0] ?? String(rawMsg);
          setError(firstLine);
          setCode("");
        } finally {
          if (!cancelled) setWorking(false);
        }
      })();
    }, 180);
    return () => {
      cancelled = true;
      abort.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
    };
  }, [stableGraph, language, engine]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!resizing.current) return;
    const dx = startX.current - e.clientX; // dragging left handle; increasing dx widens panel
    const next = Math.min(Math.max(startW.current + dx, 280), Math.max(window.innerWidth - 120, 280));
    setWidth(next);
  }, []);

  const onMouseUp = useCallback(() => {
    resizing.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const onHandleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  if (variant === "node") {
    const display = working ? "Compiling…" : error || code;
    const lang = error ? "text" : getPrismLang(language);
    return (
      <div className={cn("h-full flex flex-col", className)}>
        <div className="px-3 py-2 border-b flex items-center justify-end gap-2">
          <div className="min-w-[140px]">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger aria-label="Language">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.key} value={l.key}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[120px]">
            <Select value={engine} onValueChange={setEngine}>
              <SelectTrigger aria-label="Compiler">
                <SelectValue placeholder="Compiler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <CodeBlock language={lang} code={String(display ?? "")} className="h-full" />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="min-w-[160px]">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger aria-label="Language">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.key} value={l.key}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <Select value={engine} onValueChange={setEngine}>
              <SelectTrigger aria-label="Compiler">
                <SelectValue placeholder="Compiler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => copyToClipboard(code)} disabled={!code}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? "Expand" : "Collapse"}
          </Button>
        </div>
      </div>
      {!collapsed && (
        <div className="flex-1 min-h-0 relative">
          <div
            role="separator"
            className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10"
            onMouseDown={onHandleMouseDown}
            aria-orientation="vertical"
          />
          <div className="absolute left-0 top-0 right-0 bottom-0 overflow-auto">
            <CodeBlock language={getPrismLang(language)} code={code} className="h-full" />
          </div>
        </div>
      )}
    </Card>
  );
}

export default CompilePanel;
