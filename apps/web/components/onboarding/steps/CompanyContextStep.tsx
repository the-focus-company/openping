"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
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

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

interface CompanyContextStepProps {
  workspaceName: string;
  workspaceId: Id<"workspaces">;
  onNext: () => void;
}

export function CompanyContextStep({
  workspaceName,
  workspaceId,
  onNext,
}: CompanyContextStepProps) {
  const stripped = stripWorkspaceSuffix(workspaceName);
  const [companyName, setCompanyName] = useState(stripped);
  const [slug, setSlug] = useState(toSlug(stripped));
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const saveCompanyContext = useMutation(api.onboarding.saveCompanyContext);

  // Check slug availability
  const existingWorkspace = useQuery(
    api.workspaces.getBySlug,
    slug ? { slug } : "skip",
  );
  const slugTaken = existingWorkspace !== null && existingWorkspace !== undefined && existingWorkspace._id !== workspaceId;

  async function handleContinue() {
    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }
    if (!slug.trim()) {
      setError("Workspace URL is required");
      return;
    }
    if (slugTaken) {
      setError("This URL is already taken");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await saveCompanyContext({
        workspaceId,
        companyName,
        slug,
        industry,
        companySize,
        companyDescription,
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
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
            onChange={(e) => {
              setCompanyName(e.target.value);
              setSlug(toSlug(e.target.value));
              setError("");
            }}
            placeholder="Acme Inc."
            className="border-subtle bg-surface-2"
          />
        </div>

        <div className="space-y-2">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Workspace URL
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000"}/app/</span>
            <Input
              value={slug}
              onChange={(e) => {
                setSlug(toSlug(e.target.value));
                setError("");
              }}
              placeholder="acme"
              className="border-subtle bg-surface-2"
            />
          </div>
          {slugTaken && (
            <p className="text-xs text-destructive">This URL is already taken</p>
          )}
          {slug && !slugTaken && existingWorkspace !== undefined && (
            <p className="text-xs text-status-online">Available</p>
          )}
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

      {error && <p className="text-xs text-destructive">{error}</p>}

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
          disabled={saving || slugTaken}
        >
          {saving ? "Saving\u2026" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
