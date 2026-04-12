"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight, Plus } from "lucide-react";

interface PendingInvitation {
  token: string;
  workspaceName: string;
}

interface JoinWorkspaceStepProps {
  pendingInvitations: PendingInvitation[];
  onCreateOwn: () => void;
}

export function JoinWorkspaceStep({
  pendingInvitations,
  onCreateOwn,
}: JoinWorkspaceStepProps) {
  const router = useRouter();
  const [joiningToken, setJoiningToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptInvite = useMutation(api.invitations.accept);
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);

  const handleJoin = async (token: string) => {
    setJoiningToken(token);
    setError(null);
    try {
      const result = await acceptInvite({ token });
      await completeOnboarding();
      router.replace(`/app/${result.slug}/inbox`);
    } catch (e) {
      setJoiningToken(null);
      setError(e instanceof Error ? e.message : "Failed to join workspace");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          You have pending invitations
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Join a workspace you&apos;ve been invited to, or set up your own.
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="space-y-2">
        {pendingInvitations.map((inv) => (
          <div
            key={inv.token}
            className="flex items-center justify-between rounded-lg border border-subtle bg-surface-2 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ping-purple/10">
                <Building2 className="h-4 w-4 text-ping-purple" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {inv.workspaceName}
                </p>
                <p className="text-2xs text-muted-foreground">Pending invitation</p>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-ping-purple px-4 text-xs text-white hover:bg-ping-purple/90"
              onClick={() => handleJoin(inv.token)}
              disabled={joiningToken !== null}
            >
              {joiningToken === inv.token ? (
                "Joining..."
              ) : (
                <>
                  Join <ArrowRight className="ml-1.5 h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-subtle" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-2xs font-medium uppercase tracking-widest text-foreground/30">
            or
          </span>
        </div>
      </div>

      <button
        onClick={onCreateOwn}
        disabled={joiningToken !== null}
        className="flex w-full items-center justify-between rounded-lg border border-subtle bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-2/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground/5">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Set up my own workspace
            </p>
            <p className="text-2xs text-muted-foreground">
              Create and configure a new workspace
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
