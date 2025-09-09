import React from "react";
import { Highlight, themes } from "prism-react-renderer";
import { cn } from "@/lib/utils";

export type CodeBlockProps = {
  code: string;
  language: string;
  className?: string;
};

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  return (
    <Highlight theme={themes.github} code={code} language={language}>
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

