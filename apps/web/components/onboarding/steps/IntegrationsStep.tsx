"use client";

import { Button } from "@/components/ui/button";
import { Github, Layers, MessageSquare } from "lucide-react";

const INTEGRATIONS = [
  {
    name: "GitHub",
    description: "Link pull requests, issues, and code reviews to conversations.",
    icon: Github,
  },
  {
    name: "Linear",
    description: "Sync project issues and track progress directly in PING.",
    icon: Layers,
  },
  {
    name: "Slack",
    description: "Import channels and message history from Slack.",
    icon: MessageSquare,
  },
] as const;

interface IntegrationsStepProps {
  onNext: () => void;
}

export function IntegrationsStep({ onNext }: IntegrationsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Connect your tools
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Integrations bring context from your existing tools into PING.
        </p>
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center gap-4 rounded-md border border-subtle bg-surface-2 px-4 py-3"
          >
            <integration.icon className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {integration.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {integration.description}
              </p>
            </div>
            <span className="rounded-full border border-subtle px-2.5 py-0.5 text-2xs text-muted-foreground">
              Coming soon
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end">
        <Button
          size="sm"
          className="bg-ping-purple px-6 text-xs text-white hover:bg-ping-purple/90"
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
