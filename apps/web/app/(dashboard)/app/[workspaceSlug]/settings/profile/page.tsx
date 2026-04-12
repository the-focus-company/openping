"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarGradient } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useLoadingTimeout } from "@/hooks/useLoadingTimeout";

export default function ProfilePage() {
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const updateProfile = useMutation(api.users.updateProfile);

  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [bio, setBio] = useState("");
  const [expertiseText, setExpertiseText] = useState("");
  const [workContext, setWorkContext] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusEmoji, setStatusEmoji] = useState("");
  const [timezone, setTimezone] = useState("");
  const [preferredHours, setPreferredHours] = useState("");
  const [responseTimeGoal, setResponseTimeGoal] = useState("");
  const [inboxNotifications, setInboxNotifications] = useState(true);
  const [proactiveAlerts, setProactiveAlerts] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (user && !initialized) {
      setDisplayName(user.name);
      setTitle(user.title ?? "");
      setDepartment(user.department ?? "");
      setBio(user.bio ?? "");
      setExpertiseText(user.expertise?.join(", ") ?? "");
      setWorkContext(user.workContext ?? "");
      setStatusMessage(user.statusMessage ?? "");
      setStatusEmoji(user.statusEmoji ?? "");
      setTimezone(user.communicationPrefs?.timezone ?? "");
      setPreferredHours(user.communicationPrefs?.preferredHours ?? "");
      setResponseTimeGoal(user.communicationPrefs?.responseTimeGoal ?? "");
      setInboxNotifications(user.notificationPrefs?.inboxNotifications ?? true);
      setProactiveAlerts(user.notificationPrefs?.proactiveAlerts ?? true);
      setInitialized(true);
    }
  }, [user, initialized]);

  const handleSave = async () => {
    try {
      const expertise = expertiseText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await updateProfile({
        name: displayName,
        title: title || undefined,
        department: department || undefined,
        bio: bio || undefined,
        expertise: expertise.length > 0 ? expertise : undefined,
        workContext: workContext || undefined,
        statusMessage: statusMessage || undefined,
        statusEmoji: statusEmoji || undefined,
        communicationPrefs: {
          timezone: timezone || undefined,
          preferredHours: preferredHours || undefined,
          responseTimeGoal: responseTimeGoal || undefined,
        },
        notificationPrefs: { inboxNotifications, proactiveAlerts },
      });
      toast("Settings saved", "success");
    } catch {
      toast("Failed to save", "error");
    }
  };

  const profileTimedOut = useLoadingTimeout(user === undefined, 12_000);
  if (user === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        {profileTimedOut ? (
          <>
            <p className="text-sm text-muted-foreground">Could not load profile.</p>
            <button onClick={() => window.location.reload()} className="text-xs text-foreground/60 underline hover:text-foreground">Retry</button>
          </>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
        )}
      </div>
    );
  }

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-lg animate-fade-in px-6 py-6">
      <div className="mb-6">
        <h1 className="text-md font-semibold text-foreground">Profile</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage your profile, status, and preferences
        </p>
      </div>

      <div className="space-y-5">
        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            {user?.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            )}
            <AvatarFallback
              className={`bg-gradient-to-br ${avatarGradient(
                (user?._id ?? "") + (initials ?? ""),
              )} text-white text-lg font-medium`}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {user?.name}
            </p>
            <p className="text-2xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>

        <SectionLabel>Identity</SectionLabel>

        {/* Display name */}
        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
          />
        </Field>

        {/* Email */}
        <Field label="Email" hint="Managed by WorkOS SCIM — cannot be changed">
          <input
            value={user?.email ?? ""}
            disabled
            className="w-full rounded border border-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-muted-foreground"
          />
        </Field>

        {/* Job title */}
        <Field label="Job title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Senior Engineer"
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
          />
        </Field>

        {/* Department */}
        <Field label="Department">
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Engineering"
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
          />
        </Field>

        <SectionLabel>About you</SectionLabel>

        {/* Bio */}
        <Field label="Bio">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A short description about yourself"
            rows={3}
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none resize-none"
          />
        </Field>

        {/* Work context */}
        <Field label="What are you working on?">
          <textarea
            value={workContext}
            onChange={(e) => setWorkContext(e.target.value)}
            placeholder="Current projects, responsibilities..."
            rows={2}
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none resize-none"
          />
        </Field>

        {/* Expertise */}
        <Field label="Expertise" hint="Comma-separated areas of expertise">
          <input
            value={expertiseText}
            onChange={(e) => setExpertiseText(e.target.value)}
            placeholder="e.g. React, TypeScript, Distributed Systems"
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
          />
        </Field>

        <SectionLabel>Status</SectionLabel>

        {/* Status emoji + message */}
        <div className="flex gap-2">
          <Field label="Emoji" className="w-16">
            <input
              value={statusEmoji}
              onChange={(e) => setStatusEmoji(e.target.value)}
              placeholder="🎯"
              maxLength={4}
              className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground text-center placeholder:text-foreground/45 focus:border-ring focus:outline-none"
            />
          </Field>
          <Field label="Status message" className="flex-1">
            <input
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="e.g. In a meeting until 3pm"
              className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
            />
          </Field>
        </div>

        <SectionLabel>Communication preferences</SectionLabel>

        {/* Timezone */}
        <Field label="Timezone">
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. America/New_York, CET"
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
          />
        </Field>

        {/* Preferred hours */}
        <Field label="Preferred hours">
          <input
            value={preferredHours}
            onChange={(e) => setPreferredHours(e.target.value)}
            placeholder="e.g. 9am–5pm"
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
          />
        </Field>

        {/* Response time goal */}
        <Field label="Response time goal">
          <input
            value={responseTimeGoal}
            onChange={(e) => setResponseTimeGoal(e.target.value)}
            placeholder="e.g. 30 minutes, 1 hour"
            className="w-full rounded border border-subtle bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/45 focus:border-ring focus:outline-none"
          />
        </Field>

        <SectionLabel>Notifications</SectionLabel>

        {/* Notifications */}
        <div className="space-y-2">
          <ToggleRow
            label="Inbox notifications"
            description="Get notified about new priority items"
            checked={inboxNotifications}
            onChange={setInboxNotifications}
          />
          <ToggleRow
            label="Proactive alerts"
            description="Ambient alerts for blocked tasks and incidents"
            checked={proactiveAlerts}
            onChange={setProactiveAlerts}
          />
        </div>

        {/* Theme */}
        <SectionLabel>Appearance</SectionLabel>
        <div className="rounded border border-subtle bg-surface-1 px-3 py-2">
          <p className="text-xs text-foreground">Dark</p>
          <p className="text-2xs text-muted-foreground">System default</p>
        </div>

        {/* Save */}
        <div className="pt-2 pb-4">
          <Button
            className="h-8 w-full bg-ping-purple text-xs text-white hover:bg-ping-purple-hover"
            onClick={handleSave}
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-3">
      <p className="text-2xs font-medium uppercase tracking-widest text-foreground/40">
        {children}
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-foreground/40">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-2xs text-foreground/40">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer rounded border border-subtle bg-surface-1 px-3 py-2.5">
      <div>
        <p className="text-xs text-foreground">{label}</p>
        <p className="text-2xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-ping-purple" : "bg-surface-3"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
