"use client";

import { memo, useCallback, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="rounded p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/60"
      aria-label="Copy code"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

const components: Components = {
  // Paragraphs: no extra margin for chat context
  p({ children }) {
    return <p className="mb-1 last:mb-0">{children}</p>;
  },

  // Links: open in new tab
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ping-purple underline decoration-ping-purple/40 underline-offset-2 transition-colors hover:text-ping-purple-hover hover:decoration-ping-purple/60"
      >
        {children}
      </a>
    );
  },

  // Bold
  strong({ children }) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
  },

  // Italic
  em({ children }) {
    return <em className="italic text-foreground/80">{children}</em>;
  },

  // Inline code
  code({ className, children }) {
    const isBlock = className?.includes("hljs") || className?.includes("language-");

    if (isBlock) {
      // Block code is handled by <pre> wrapper; just render the code element
      return <code className={cn("text-[13px] leading-relaxed", className)}>{children}</code>;
    }

    return (
      <code className="rounded border border-foreground/8 bg-foreground/8 px-1 py-0.5 text-[12px] font-mono text-pink-300/90">
        {children}
      </code>
    );
  },

  // Code blocks
  pre({ children }) {
    // Extract the text content for the copy button
    let codeText = "";
    let language = "";

    // children is the <code> element rendered by react-markdown
    if (
      children &&
      typeof children === "object" &&
      "props" in (children as React.ReactElement)
    ) {
      const codeEl = children as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;
      const codeClassName = codeEl.props?.className || "";
      language = codeClassName.replace(/^language-/, "").replace(/^hljs\s*/, "").split(" ")[0] || "";

      // Extract text from children
      const extractText = (node: React.ReactNode): string => {
        if (typeof node === "string") return node;
        if (typeof node === "number") return String(node);
        if (Array.isArray(node)) return node.map(extractText).join("");
        if (node && typeof node === "object" && "props" in (node as React.ReactElement)) {
          return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props?.children);
        }
        return "";
      };

      codeText = extractText(codeEl.props?.children).trimEnd();
    }

    return (
      <div className="group/code relative my-2 overflow-hidden rounded border border-white/6 bg-[hsl(240,7%,8%)]">
        {/* Header bar with language + copy */}
        <div className="flex items-center justify-between border-b border-white/6 px-3 py-1">
          <span className="text-2xs font-mono text-white/30">
            {language || "code"}
          </span>
          <CopyButton text={codeText} />
        </div>
        {/* Code content */}
        <div className="overflow-x-auto p-3">
          <pre className="!m-0 !bg-transparent !p-0">{children}</pre>
        </div>
      </div>
    );
  },

  // Lists
  ul({ children }) {
    return <ul className="mb-1 ml-4 list-disc space-y-0.5 last:mb-0 [&_ul]:mb-0 [&_ul]:mt-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-1 ml-4 list-decimal space-y-0.5 last:mb-0 [&_ol]:mb-0 [&_ol]:mt-0.5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-sm leading-relaxed">{children}</li>;
  },

  // Blockquotes
  blockquote({ children }) {
    return (
      <blockquote className="my-1.5 border-l-2 border-ping-purple/40 pl-3 text-foreground/70 italic">
        {children}
      </blockquote>
    );
  },

  // Headings (scaled down for chat context)
  h1({ children }) {
    return <h1 className="mb-1 mt-2 text-base font-bold text-foreground first:mt-0">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="mb-1 mt-2 text-sm font-bold text-foreground first:mt-0">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="mb-0.5 mt-1.5 text-sm font-semibold text-foreground first:mt-0">{children}</h3>;
  },

  // Horizontal rule
  hr() {
    return <hr className="my-2 border-foreground/8" />;
  },

  // Tables
  table({ children }) {
    return (
      <div className="my-2 overflow-x-auto rounded border border-foreground/8">
        <table className="w-full text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="border-b border-foreground/8 bg-foreground/4">{children}</thead>;
  },
  th({ children }) {
    return <th className="px-3 py-1.5 text-left text-2xs font-semibold text-foreground/80">{children}</th>;
  },
  td({ children }) {
    return <td className="border-t border-foreground/4 px-3 py-1.5 text-foreground/70">{children}</td>;
  },

  // Strikethrough
  del({ children }) {
    return <del className="text-foreground/40 line-through">{children}</del>;
  },
};

interface MarkdownContentProps {
  content: string;
  className?: string;
  onClickMention?: (name: string) => void;
}

/** Split text into segments of plain text and @mentions */
function splitMentions(text: string): Array<{ type: "text"; value: string } | { type: "mention"; name: string }> {
  const parts: Array<{ type: "text"; value: string } | { type: "mention"; name: string }> = [];
  const regex = /@([A-Za-z0-9_À-ž]+(?:\s[A-Z_À-Ž][A-Za-z0-9_À-ž]*)?)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "mention", name: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

/** Render inline text with @mention pills */
function MentionText({ text, onClickMention }: { text: string; onClickMention?: (name: string) => void }) {
  const parts = splitMentions(text);
  if (parts.length === 1 && parts[0].type === "text") return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <button
            key={i}
            type="button"
            onClick={() => onClickMention?.(part.name)}
            className={cn(
              "inline-flex items-center rounded bg-ping-purple/15 px-1 py-px text-ping-purple font-medium",
              onClickMention && "cursor-pointer hover:bg-ping-purple/25 transition-colors",
            )}
          >
            @{part.name}
          </button>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}

/** Build mention-aware components with an optional click handler */
function buildMentionComponents(onClickMention?: (name: string) => void): Components {
  function processChildren(children: React.ReactNode): React.ReactNode {
    if (typeof children === "string") {
      return <MentionText text={children} onClickMention={onClickMention} />;
    }
    if (Array.isArray(children)) {
      return children.map((child, i) => {
        if (typeof child === "string") return <MentionText key={i} text={child} onClickMention={onClickMention} />;
        return child;
      });
    }
    return children;
  }

  return {
    ...components,
    p({ children }) {
      const processed = processChildren(children);
      return <p className="mb-1 last:mb-0">{processed}</p>;
    },
    li({ children }) {
      const processed = processChildren(children);
      return <li className="text-sm leading-relaxed">{processed}</li>;
    },
  };
}

// Default components without click handler (for backwards compatibility)
const defaultMentionComponents = buildMentionComponents();

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className,
  onClickMention,
}: MarkdownContentProps) {
  const mentionComps = onClickMention ? buildMentionComponents(onClickMention) : defaultMentionComponents;

  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={mentionComps}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
