import { BrandingSettings, UserProfile } from "../types";

export const DEFAULT_WORKSPACE_NAME = "Deckly Data Room";

export type OnboardingStage = "workspace" | "about-you" | "complete";

export function getOnboardingStage(
  profile?: Pick<
    UserProfile,
    "handle" | "full_name" | "tutorial_state"
  > | null,
  branding?: Pick<BrandingSettings, "room_name"> | null,
): OnboardingStage {
  if (!profile) return "workspace";

  const state = profile.tutorial_state;
  if (state?.onboarding_completed || state?.dashboard_completed) {
    return "complete";
  }

  if (state?.workspace_setup_completed) {
    return state?.profile_onboarding_completed ? "complete" : "about-you";
  }

  const handle = profile.handle?.trim();
  const roomName = branding?.room_name?.trim();
  const hasWorkspaceIdentity = Boolean(
    handle &&
      roomName &&
      roomName.length > 0 &&
      roomName !== DEFAULT_WORKSPACE_NAME,
  );

  if (hasWorkspaceIdentity) {
    return "complete";
  }

  return "workspace";
}

export function isWorkspaceSetupComplete(
  profile?: Pick<UserProfile, "handle" | "full_name" | "tutorial_state"> | null,
  branding?: Pick<BrandingSettings, "room_name"> | null,
) {
  return getOnboardingStage(profile, branding) !== "workspace";
}

export function isOnboardingComplete(
  profile?: Pick<
    UserProfile,
    "handle" | "full_name" | "tutorial_state"
  > | null,
  branding?: Pick<BrandingSettings, "room_name"> | null,
) {
  return getOnboardingStage(profile, branding) === "complete";
}
