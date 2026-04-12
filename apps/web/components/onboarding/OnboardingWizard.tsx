"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@convex/_generated/api";
import { Loader2 } from "lucide-react";
import { OnboardingLayout } from "./OnboardingLayout";
import { OnboardingProgress } from "./OnboardingProgress";
import { PersonalContextStep } from "./steps/PersonalContextStep";
import { CompanyContextStep } from "./steps/CompanyContextStep";
import { WorkspaceSetupStep } from "./steps/WorkspaceSetupStep";
import { AiPrefsStep } from "./steps/AiPrefsStep";
import { IntegrationsStep } from "./steps/IntegrationsStep";
import { InviteTeamStep } from "./steps/InviteTeamStep";
import { ChannelSelectionStep } from "./steps/ChannelSelectionStep";
import { CommunicationPrefsStep } from "./steps/CommunicationPrefsStep";
import { JoinWorkspaceStep } from "./steps/JoinWorkspaceStep";

const ADMIN_LABELS = [
  "Personal context",
  "Company context",
  "Workspace setup",
  "AI preferences",
  "Integrations",
  "Invite team",
];

const MEMBER_LABELS = [
  "Personal context",
  "Join channels",
  "AI preferences",
  "Communication",
];

export function OnboardingWizard({
  targetWorkspaceSlug,
}: {
  targetWorkspaceSlug?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const { isAuthenticated } = useConvexAuth();
  const workspaces = useQuery(
    api.workspaceMembers.listMyWorkspaces,
    isAuthenticated ? {} : "skip",
  );
  const selectedWorkspace =
    workspaces?.find((workspace) => workspace.slug === targetWorkspaceSlug) ??
    workspaces?.[0];
  const workspaceId = selectedWorkspace?.workspaceId;
  const workspaceSlug = selectedWorkspace?.slug;

  const state = useQuery(api.onboarding.getOnboardingState, workspaceId ? { workspaceId } : "skip");
  const completeOnboarding = useMutation(api.onboarding.completeOnboarding);

  const shouldRedirect = state !== undefined && state !== null &&
    (state.onboardingStatus === "completed" || !state.onboardingStatus);

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(workspaceSlug ? `/app/${workspaceSlug}/inbox` : "/");
    }
  }, [shouldRedirect, router, workspaceSlug]);

  if (state === undefined || workspaces === undefined) {
    return (
      <OnboardingLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-ping-purple" />
        </div>
      </OnboardingLayout>
    );
  }

  if (shouldRedirect) {
    return null;
  }

  const isAdmin = state.role === "admin";
  const hasPendingInvitations = isAdmin && (state.pendingInvitations?.length ?? 0) > 0;
  const labels = isAdmin
    ? hasPendingInvitations
      ? [ADMIN_LABELS[0], "Join or create", ...ADMIN_LABELS.slice(1)]
      : ADMIN_LABELS
    : MEMBER_LABELS;
  const totalSteps = labels.length;

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      await completeOnboarding();
      // Redirect to root — it will re-query workspaces and navigate to correct workspace slug
      window.location.href = "/";
    }
  };

  function renderStep() {
    if (!state || !workspaceId) return null;

    if (isAdmin) {
      const steps = [
        () => (
          <PersonalContextStep
            userName={state.userName ?? ""}
            role="admin"
            onNext={handleNext}
          />
        ),
        ...(hasPendingInvitations
          ? [() => (
              <JoinWorkspaceStep
                pendingInvitations={state.pendingInvitations ?? []}
                onCreateOwn={handleNext}
              />
            )]
          : []),
        () => (
          <CompanyContextStep
            workspaceName={state.workspaceName ?? ""}
            workspaceId={workspaceId}
            onNext={handleNext}
          />
        ),
        () => <WorkspaceSetupStep workspaceId={workspaceId} onNext={handleNext} />,
        () => <AiPrefsStep onNext={handleNext} />,
        () => <IntegrationsStep onNext={handleNext} />,
        () => <InviteTeamStep workspaceId={workspaceId} onNext={handleNext} />,
      ];
      return steps[step]?.() ?? null;
    }

    switch (step) {
      case 0:
        return (
          <PersonalContextStep
            userName={state.userName ?? ""}
            role="member"
            onNext={handleNext}
          />
        );
      case 1:
        return <ChannelSelectionStep workspaceId={workspaceId} onNext={handleNext} />;
      case 2:
        return <AiPrefsStep onNext={handleNext} />;
      case 3:
        return <CommunicationPrefsStep onNext={handleNext} />;
      default:
        return null;
    }
  }

  return (
    <OnboardingLayout>
      <OnboardingProgress currentStep={step} labels={labels} />
      {renderStep()}
    </OnboardingLayout>
  );
}
