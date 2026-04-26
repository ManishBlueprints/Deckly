/// <reference types="vitest/globals" />

import {
  DEFAULT_WORKSPACE_NAME,
  getOnboardingStage,
  isOnboardingComplete,
  isWorkspaceSetupComplete,
} from "./onboarding";

describe("isWorkspaceSetupComplete", () => {
  it("returns false when the profile is missing", () => {
    expect(isWorkspaceSetupComplete(null, null)).toBe(false);
  });

  it("returns true when onboarding is already marked complete", () => {
    expect(
      isWorkspaceSetupComplete(
        {
          full_name: null,
          handle: null,
          tutorial_state: { onboarding_completed: true },
        },
        null,
      ),
    ).toBe(true);
  });

  it("requires both a handle and a non-default workspace name", () => {
    expect(
      isWorkspaceSetupComplete(
        { full_name: null, handle: "acme", tutorial_state: {} },
        { room_name: DEFAULT_WORKSPACE_NAME },
      ),
    ).toBe(false);

    expect(
      isWorkspaceSetupComplete(
        { full_name: null, handle: "acme", tutorial_state: {} },
        { room_name: "Acme Corp" },
      ),
    ).toBe(true);
  });

  it("moves to about-you after workspace setup is explicitly completed", () => {
    expect(
      getOnboardingStage(
        {
          handle: "acme",
          full_name: "Alex Doe",
          tutorial_state: { workspace_setup_completed: true },
        },
        { room_name: "Acme Corp" },
      ),
    ).toBe("about-you");
  });

  it("treats workspace and about-you onboarding as complete when both flags are set", () => {
    expect(
      isOnboardingComplete(
        {
          handle: "acme",
          full_name: "Alex Doe",
          tutorial_state: {
            workspace_setup_completed: true,
            profile_onboarding_completed: true,
          },
        },
        { room_name: "Acme Corp" },
      ),
    ).toBe(true);
  });
});
