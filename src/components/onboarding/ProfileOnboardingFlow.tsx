import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { WorkspaceOnboardingTour } from "../tours/WorkspaceOnboardingTour";
import { MascotSettingsModal } from "../dashboard/MascotSettingsModal";
import { AboutYouOnboardingModal } from "./AboutYouOnboardingModal";
import { getOnboardingStage } from "../../utils/onboarding";

interface ProfileOnboardingFlowProps {
  onCompletionStart: () => void;
  onCompletionFailed: () => void;
}

export function ProfileOnboardingFlow({
  onCompletionStart,
  onCompletionFailed,
}: ProfileOnboardingFlowProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, branding, setBranding } = useAuth();

  const onboardingStep = useMemo(() => {
    const value = new URLSearchParams(location.search).get("onboarding");
    return value === "about-you" ? "about-you" : "workspace";
  }, [location.search]);

  const stage = getOnboardingStage(profile, branding);
  const currentStep =
    onboardingStep === "about-you" || stage === "about-you"
      ? "about-you"
      : "workspace";

  if (currentStep === "workspace") {
    return (
      <>
        <WorkspaceOnboardingTour />
        <MascotSettingsModal
          isOpen
          onClose={() => undefined}
          branding={branding}
          onUpdate={setBranding}
          userProfile={profile || undefined}
          setupMode
          onComplete={() => navigate("/profile?onboarding=about-you", { replace: true })}
        />
      </>
    );
  }

  return (
    <AboutYouOnboardingModal
      isOpen
      onCompletionStart={onCompletionStart}
      onCompletionFailed={onCompletionFailed}
      onComplete={() => navigate("/", { replace: true })}
    />
  );
}
