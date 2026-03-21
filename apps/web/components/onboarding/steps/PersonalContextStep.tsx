"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface PersonalContextStepProps {
  userName: string;
  role: "admin" | "member";
  onNext: () => void;
}

export function PersonalContextStep({
  userName,
  role,
  onNext,
}: PersonalContextStepProps) {
  const [name, setName] = useState(userName);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [workContext, setWorkContext] = useState("");
  const [expertise, setExpertise] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  const updateProfile = useMutation(api.users.updateProfile);
  const savePersonalContext = useMutation(api.onboarding.savePersonalContext);

  const handleContinue = async () => {
    setSaving(true);
    try {
      if (name !== userName) {
        await updateProfile({ name });
      }
      await savePersonalContext({
        title,
        department,
        bio,
        expertise: expertise
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        workContext,
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
          Tell us about yourself
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Help your team and AI assistant understand your role.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Display Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-subtle bg-surface-2"
            placeholder="Your name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Job Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-subtle bg-surface-2"
            placeholder="e.g. Senior Engineer"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            Department
          </label>
          <Input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="border-subtle bg-surface-2"
            placeholder="e.g. Engineering"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
            What do you work on?
          </label>
          <Textarea
            value={workContext}
            onChange={(e) => setWorkContext(e.target.value)}
            className="border-subtle bg-surface-2"
            placeholder="Describe your current projects or responsibilities"
            rows={3}
          />
        </div>

        {role === "member" && (
          <>
            <div className="space-y-1.5">
              <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
                Expertise Areas
              </label>
              <Input
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                className="border-subtle bg-surface-2"
                placeholder="e.g. React, TypeScript, infrastructure"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-2xs font-medium uppercase tracking-widest text-white/40">
                Short Bio
              </label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="border-subtle bg-surface-2"
                placeholder="A brief intro for your teammates"
                rows={2}
              />
            </div>
          </>
        )}
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
