"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RESPONSE_TIME_OPTIONS = [
  "Within 1 hour",
  "Within 4 hours",
  "Same day",
  "No preference",
] as const;

type ResponseTimeGoal = (typeof RESPONSE_TIME_OPTIONS)[number];

interface CommunicationPrefsStepProps {
  onNext: () => void;
}

export function CommunicationPrefsStep({ onNext }: CommunicationPrefsStepProps) {
  const [timezone, setTimezone] = useState("");
  const [preferredHours, setPreferredHours] = useState("9am-5pm");
  const [responseTimeGoal, setResponseTimeGoal] =
    useState<ResponseTimeGoal>("Within 4 hours");
  const [saving, setSaving] = useState(false);

  const saveCommunicationPrefs = useMutation(
    api.onboarding.saveCommunicationPrefs,
  );

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const handleContinue = async () => {
    setSaving(true);
    try {
      await saveCommunicationPrefs({
        communicationPrefs: { timezone, preferredHours, responseTimeGoal },
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
          Communication Preferences
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Help your team know the best way to reach you.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Timezone
          </label>
          <Input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="border-subtle bg-surface-2"
            placeholder="e.g. America/New_York"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Preferred Working Hours
          </label>
          <Input
            value={preferredHours}
            onChange={(e) => setPreferredHours(e.target.value)}
            className="border-subtle bg-surface-2"
            placeholder="e.g. 9am-5pm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Response Time Goal
          </label>
          <div className="flex flex-wrap gap-2">
            {RESPONSE_TIME_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setResponseTimeGoal(option)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  responseTimeGoal === option
                    ? "border-ping-purple bg-ping-purple/15 text-ping-purple"
                    : "border-subtle bg-surface-2 text-muted-foreground hover:border-white/20",
                )}
              >
                {option}
              </button>
            ))}
          </div>
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
