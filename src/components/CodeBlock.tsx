import React, { useEffect, useState } from "react";
import { Highlight, themes, type Language } from "prism-react-renderer";
import { cn } from "@/lib/utils";

export type CodeBlockProps = {
  code: string;
  language: string;
  className?: string;
};

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver((m) => {
      for (const rec of m) {
        if (rec.type === "attributes" && rec.attributeName === "class") {
          update();
        }
      }
    });
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return (
    <Highlight
      theme={isDark ? themes.vsDark : themes.github}
      code={code}
      language={language as Language}
    >
      {({ className: cls, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            cls,
            "text-xs leading-relaxed whitespace-pre-wrap break-words overflow-auto rounded-md bg-muted p-2",
            className
          )}
          style={style}
          onPointerDownCapture={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}

export default CodeBlock;
