"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
  labels: string[];
}

export function OnboardingProgress({
  currentStep,
  labels,
}: OnboardingProgressProps) {
  const totalSteps = labels.length;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-center">
        {labels.map((_, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;

          return (
            <div key={i} className="flex items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isCompleted &&
                    "bg-ping-purple text-white",
                  isCurrent &&
                    "border-2 border-ping-purple bg-ping-purple/15 text-ping-purple",
                  !isCompleted &&
                    !isCurrent &&
                    "border border-subtle bg-surface-1 text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>

              {i < totalSteps - 1 && (
                <div
                  className={cn(
                    "mx-1 h-px w-8",
                    i < currentStep ? "bg-ping-purple" : "bg-subtle"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {labels[currentStep]}
      </p>
    </div>
  );
}
