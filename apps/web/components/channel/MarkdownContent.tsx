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
      <code className="rounded border border-white/8 bg-white/8 px-1 py-0.5 text-[12px] font-mono text-pink-300/90">
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
    return <hr className="my-2 border-white/8" />;
  },

  // Tables
  table({ children }) {
    return (
      <div className="my-2 overflow-x-auto rounded border border-white/8">
        <table className="w-full text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="border-b border-white/8 bg-white/4">{children}</thead>;
  },
  th({ children }) {
    return <th className="px-3 py-1.5 text-left text-2xs font-semibold text-foreground/80">{children}</th>;
  },
  td({ children }) {
    return <td className="border-t border-white/4 px-3 py-1.5 text-foreground/70">{children}</td>;
  },

  // Strikethrough
  del({ children }) {
    return <del className="text-foreground/40 line-through">{children}</del>;
  },
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
  className,
}: MarkdownContentProps) {
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
