"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "E-commerce",
  "Media",
  "Manufacturing",
  "Consulting",
  "Government",
  "Non-profit",
  "Other",
] as const;

function stripWorkspaceSuffix(name: string): string {
  return name.replace(/'s Workspace$/i, "").replace(/\u2019s Workspace$/i, "");
}

interface CompanyContextStepProps {
  workspaceName: string;
  onNext: () => void;
}

export function CompanyContextStep({
  workspaceName,
  onNext,
}: CompanyContextStepProps) {
  const [companyName, setCompanyName] = useState(
    stripWorkspaceSuffix(workspaceName)
  );
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const saveCompanyContext = useMutation(api.onboarding.saveCompanyContext);

  async function handleContinue() {
    setSaving(true);
    try {
      await saveCompanyContext({
        companyName,
        industry,
        companySize,
        companyDescription,
      });
      onNext();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Tell us about your company
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This helps PING personalize your workspace experience.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Company Name
          </label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Inc."
            className="border-subtle bg-surface-2"
          />
          <p className="text-xs text-muted-foreground">
            This will also be your workspace name.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Company Size
          </label>
          <div className="flex flex-wrap gap-2">
            {COMPANY_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setCompanySize(size)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  companySize === size
                    ? "border-ping-purple bg-ping-purple/15 text-ping-purple"
                    : "border-subtle bg-surface-2 text-muted-foreground hover:border-white/20"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Industry
          </label>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => setIndustry(ind)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  industry === ind
                    ? "border-ping-purple bg-ping-purple/15 text-ping-purple"
                    : "border-subtle bg-surface-2 text-muted-foreground hover:border-white/20"
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Company Description
          </label>
          <Textarea
            value={companyDescription}
            onChange={(e) => setCompanyDescription(e.target.value)}
            placeholder="What does your company do?"
            rows={3}
            className="border-subtle bg-surface-2"
          />
        </div>
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
