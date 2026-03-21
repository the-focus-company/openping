"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Hash } from "lucide-react";

interface ChannelOption {
  name: string;
  description: string;
  defaultSelected: boolean;
}

const SUGGESTED_CHANNELS: ChannelOption[] = [
  {
    name: "engineering",
    description: "Technical discussions and dev updates",
    defaultSelected: true,
  },
  {
    name: "design",
    description: "Design reviews, assets, and feedback",
    defaultSelected: false,
  },
  {
    name: "product",
    description: "Product roadmap and feature planning",
    defaultSelected: false,
  },
  {
    name: "random",
    description: "Water cooler chat and off-topic fun",
    defaultSelected: true,
  },
  {
    name: "announcements",
    description: "Company-wide updates and news",
    defaultSelected: true,
  },
  {
    name: "help",
    description: "Ask questions and get support",
    defaultSelected: false,
  },
];

interface WorkspaceSetupStepProps {
  onNext: () => void;
}

export function WorkspaceSetupStep({ onNext }: WorkspaceSetupStepProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        SUGGESTED_CHANNELS.filter((c) => c.defaultSelected).map((c) => c.name)
      )
  );
  const [saving, setSaving] = useState(false);

  const createDefaultChannels = useMutation(
    api.onboarding.createDefaultChannels
  );

  function toggleChannel(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  async function handleContinue() {
    setSaving(true);
    try {
      await createDefaultChannels({ channelNames: [...selected] });
      onNext();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Set up your channels
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose which channels to create for your workspace.
        </p>
      </div>

      <div className="space-y-2">
        {/* General channel - always on */}
        <label className="flex items-center gap-3 rounded-md border border-subtle bg-surface-2 px-3 py-2.5 opacity-60">
          <input type="checkbox" checked disabled className="accent-ping-purple" />
          <Hash className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <span className="text-sm text-foreground">general</span>
            <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-2xs text-muted-foreground">
              Default
            </span>
          </div>
        </label>

        {/* Suggested channels */}
        {SUGGESTED_CHANNELS.map((channel) => (
          <label
            key={channel.name}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-subtle bg-surface-2 px-3 py-2.5 transition-colors hover:border-white/20"
          >
            <input
              type="checkbox"
              checked={selected.has(channel.name)}
              onChange={() => toggleChannel(channel.name)}
              className="accent-ping-purple"
            />
            <Hash className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm text-foreground">{channel.name}</span>
              <p className="text-xs text-muted-foreground">
                {channel.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={onNext}
          disabled={saving}
        >
          Skip
        </Button>
        <Button
          size="sm"
          className="bg-ping-purple px-6 text-xs text-white hover:bg-ping-purple/90"
          onClick={handleContinue}
          disabled={saving}
        >
          {saving ? "Saving\u2026" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
