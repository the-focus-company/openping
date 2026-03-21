"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { toast } = useToast();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const updateProfile = useMutation(api.users.updateProfile);

  const [displayName, setDisplayName] = useState("");
  const [inboxNotifications, setInboxNotifications] = useState(true);
  const [proactiveAlerts, setProactiveAlerts] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (user && !initialized) {
      setDisplayName(user.name);
      setInboxNotifications(user.notificationPrefs?.inboxNotifications ?? true);
      setProactiveAlerts(user.notificationPrefs?.proactiveAlerts ?? true);
      setInitialized(true);
    }
  }, [user, initialized]);

  const handleSave = async () => {
    try {
      await updateProfile({
        name: displayName,
        notificationPrefs: { inboxNotifications, proactiveAlerts },
      });
      toast("Settings saved", "success");
    } catch {
      toast("Failed to save", "error");
    }
  };

  if (user === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg animate-fade-in px-6 py-6">
      <div className="mb-6">
        <h1 className="text-md font-semibold text-foreground">Profile</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="space-y-5">
        {/* Display name */}
        <div>
          <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded border border-subtle bg-surface-2 px-2.5 py-1.5 text-xs text-foreground placeholder:text-white/25 focus:border-white/20 focus:outline-none"
          />
        </div>

        {/* Email */}
        <div>
          <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
            Email
          </label>
          <input
            value={user?.email ?? ""}
            disabled
            className="w-full rounded border border-subtle bg-surface-1 px-2.5 py-1.5 text-xs text-muted-foreground"
          />
          <p className="mt-1 text-2xs text-white/20">Managed by WorkOS SCIM — cannot be changed</p>
        </div>

        {/* Notifications */}
        <div>
          <label className="mb-2 block text-2xs font-medium uppercase tracking-widest text-white/40">
            Notifications
          </label>
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer rounded border border-subtle bg-surface-1 px-3 py-2.5">
              <div>
                <p className="text-xs text-foreground">Inbox notifications</p>
                <p className="text-2xs text-muted-foreground">Get notified about new priority items</p>
              </div>
              <button
                onClick={() => setInboxNotifications((v) => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  inboxNotifications ? "bg-ping-purple" : "bg-surface-3"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    inboxNotifications ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>

            <label className="flex items-center justify-between cursor-pointer rounded border border-subtle bg-surface-1 px-3 py-2.5">
              <div>
                <p className="text-xs text-foreground">Proactive alerts</p>
                <p className="text-2xs text-muted-foreground">Ambient alerts for blocked tasks and incidents</p>
              </div>
              <button
                onClick={() => setProactiveAlerts((v) => !v)}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  proactiveAlerts ? "bg-ping-purple" : "bg-surface-3"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    proactiveAlerts ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Theme */}
        <div>
          <label className="mb-1.5 block text-2xs font-medium uppercase tracking-widest text-white/40">
            Theme
          </label>
          <div className="rounded border border-subtle bg-surface-1 px-3 py-2">
            <p className="text-xs text-foreground">Dark</p>
            <p className="text-2xs text-muted-foreground">System default</p>
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
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
