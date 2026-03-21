"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Brain, Bell, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type SummaryDetail = "concise" | "detailed";
type ProactiveLevel = "minimal" | "balanced" | "aggressive";

const SUMMARY_OPTIONS: {
  value: SummaryDetail;
  title: string;
  subtitle: string;
}[] = [
  {
    value: "concise",
    title: "Concise",
    subtitle: "Brief summaries with key points only",
  },
  {
    value: "detailed",
    title: "Detailed",
    subtitle: "Comprehensive summaries with full context",
  },
];

const ALERT_OPTIONS: {
  value: ProactiveLevel;
  title: string;
  subtitle: string;
}[] = [
  { value: "minimal", title: "Minimal", subtitle: "Only urgent items" },
  {
    value: "balanced",
    title: "Balanced",
    subtitle: "Smart mix of alerts",
  },
  {
    value: "aggressive",
    title: "Aggressive",
    subtitle: "Surface everything",
  },
];

interface AiPrefsStepProps {
  onNext: () => void;
}

export function AiPrefsStep({ onNext }: AiPrefsStepProps) {
  const [summaryDetail, setSummaryDetail] = useState<SummaryDetail>("concise");
  const [proactiveLevel, setProactiveLevel] =
    useState<ProactiveLevel>("balanced");
  const [autoTriage, setAutoTriage] = useState(true);
  const [saving, setSaving] = useState(false);

  const saveAiPrefs = useMutation(api.onboarding.saveAiPrefs);

  const handleContinue = async () => {
    setSaving(true);
    try {
      await saveAiPrefs({
        aiPrefs: { summaryDetail, proactiveLevel, autoTriage },
      });
      onNext();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          AI Preferences
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Customize how the AI assistant works for you.
        </p>
      </div>

      <div className="space-y-5">
        {/* Summary Detail */}
        <div className="space-y-2">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            <Brain className="mr-1 inline-block h-3 w-3" />
            Summary Detail
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SUMMARY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSummaryDetail(opt.value)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  summaryDetail === opt.value
                    ? "border-ping-purple bg-ping-purple/10"
                    : "border-subtle bg-surface-2 text-muted-foreground hover:border-white/20",
                )}
              >
                <div className="text-xs font-medium">{opt.title}</div>
                <div className="mt-0.5 text-2xs text-muted-foreground">
                  {opt.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Proactive Alert Level */}
        <div className="space-y-2">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            <Bell className="mr-1 inline-block h-3 w-3" />
            Proactive Alert Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {ALERT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProactiveLevel(opt.value)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  proactiveLevel === opt.value
                    ? "border-ping-purple bg-ping-purple/10"
                    : "border-subtle bg-surface-2 text-muted-foreground hover:border-white/20",
                )}
              >
                <div className="text-xs font-medium">{opt.title}</div>
                <div className="mt-0.5 text-2xs text-muted-foreground">
                  {opt.subtitle}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Auto-triage toggle */}
        <div className="flex items-center justify-between rounded-lg border border-subtle bg-surface-2 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs font-medium">Auto-triage inbox</div>
              <div className="text-2xs text-muted-foreground">
                Automatically prioritize and categorize incoming messages
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoTriage}
            onClick={() => setAutoTriage(!autoTriage)}
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors",
              autoTriage ? "bg-ping-purple" : "bg-white/20",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                autoTriage && "translate-x-4",
              )}
            />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
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
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
