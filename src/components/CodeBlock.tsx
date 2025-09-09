import React from "react";
import { default as Highlight, type Language } from "prism-react-renderer";
import githubTheme from "prism-react-renderer/themes/github";
import { cn } from "@/lib/utils";

export type CodeBlockProps = {
  code: string;
  language: string;
  className?: string;
};

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  return (
    <Highlight theme={githubTheme} code={code} language={language as Language}>
      {({ className: cls, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            cls,
            "text-xs leading-relaxed whitespace-pre-wrap break-words overflow-auto rounded-md bg-muted p-2",
            className
          )}
          style={style}
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

