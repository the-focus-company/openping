"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { navigateToWorkspace } from "@/lib/workspace-url";

interface Props {
  params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const acceptInvite = useMutation(api.invitations.accept);

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      // Store token and redirect to sign in
      sessionStorage.setItem("pendingInviteToken", token);
      window.location.href = "/sign-in";
      return;
    }

    // Accept the invite
    acceptInvite({ token })
      .then((result) => {
        setSlug(result.slug);
        setStatus("success");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to accept invite");
        setStatus("error");
      });
  }, [isAuthenticated, authLoading, token, acceptInvite]);

  if (status === "loading") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-ping-purple" />
        <p className="text-sm text-muted-foreground">Accepting invite...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <XCircle className="h-10 w-10 text-destructive" />
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">Invite failed</h1>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button
          onClick={() => router.push("/")}
          className="bg-ping-purple text-white hover:bg-ping-purple-hover"
        >
          Go to workspaces
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <CheckCircle2 className="h-10 w-10 text-status-online" />
      <div className="text-center">
        <h1 className="text-lg font-semibold text-foreground">You&apos;re in!</h1>
        <p className="mt-1 text-sm text-muted-foreground">You&apos;ve joined the workspace</p>
      </div>
      <Button
        onClick={() => navigateToWorkspace(slug)}
        className="bg-ping-purple text-white hover:bg-ping-purple-hover"
      >
        Go to workspace
      </Button>
    </div>
  );
}
