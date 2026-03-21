"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentApiInfoProps {
  agentName: string;
}

export function AgentApiInfo({ agentName }: AgentApiInfoProps) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const endpoint = `${origin}/api/agent/v1/`;
  const curlExample = `curl -H "Authorization: Bearer <token>" ${origin}/api/agent/v1/me`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(curlExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 rounded border border-subtle bg-surface-1 p-4">
      <h4 className="text-2xs font-medium uppercase tracking-widest text-white/40">
        API Connection — {agentName}
      </h4>

      <div>
        <p className="mb-1 text-2xs text-muted-foreground">Endpoint</p>
        <code className="block rounded border border-subtle bg-surface-3 px-2.5 py-1.5 font-mono text-xs text-foreground">
          {endpoint}
        </code>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-2xs text-muted-foreground">Example request</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 gap-1 px-1.5 text-2xs text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-2.5 w-2.5 text-green-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-2.5 w-2.5" />
                Copy
              </>
            )}
          </Button>
        </div>
        <code className="block whitespace-pre-wrap break-all rounded border border-subtle bg-surface-3 px-2.5 py-1.5 font-mono text-xs text-foreground">
          {curlExample}
        </code>
      </div>
    </div>
  );
}
