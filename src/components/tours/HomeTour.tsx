import React, { useMemo, useState, useEffect } from "react";
import { EventData, Step, STATUS } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";
import { useAuth } from "../../contexts/AuthContext";

interface HomeTourProps {
  deckCount: number;
}

export const HomeTour: React.FC<HomeTourProps> = ({ deckCount }) => {
  const { profile } = useAuth();
  const { hasCompletedTour, markTourComplete } = useTourState();
  const [isReady, setIsReady] = useState(false);

  // 1. Wait for components to animate in and DOM to stabilize
  useEffect(() => {
    const timer = setTimeout(() => {
      // 2. Only signal ready if the target elements exist in DOM
      const targetExists = !!document.querySelector("#tour-upload-deck-btn") && !!document.querySelector("#tour-workspace-settings");
      if (targetExists) {
        setIsReady(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [deckCount]);

  const isTourComplete = hasCompletedTour("home_completed");
  
  // 3. Only run if:
  // - Profile has been initialized with a handle (workspace setup complete)
  // - Tour isn't finished
  // - DOM targets are ready
  const run = !!profile?.handle && !isTourComplete && isReady;

  const steps: Step[] = useMemo(
    () => [
      {
        target: "#tour-workspace-settings",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Your Brand, Your Space</h3>
            <p className="text-slate-300 text-sm">
              First, make this workspace truly yours. Click here to change your 
              <strong> Workspace Name</strong> and upload your <strong>Company Logo</strong>.
            </p>
          </div>
        ),
        placement: "right",
        disableBeacon: true,
      },
      {
        target: "#tour-upload-deck-btn",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Upload Your First Deck</h3>
            <p className="text-slate-300 text-sm">
              Welcome! Start by uploading your pitch deck (PDF or PPTX). 
              We'll instantly turn it into a trackable, professional link.
            </p>
          </div>
        ),
        placement: "bottom",
        disableBeacon: true,
        spotlightClicks: true, // Allow clicking the actual button
        buttons: ["back"], // Show only the Back button, no Next/Last
      },
    ],
    []
  );

  const handleJoyrideEvent = (data: EventData) => {
    const { status, type, index } = data;

    // Auto-open settings when the first step starts
    if (type === "step:before" && index === 0) {
      window.dispatchEvent(new CustomEvent("deckly:open-settings"));
    }

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      markTourComplete("home_completed");
    }
  };

  return (
    <JoyrideWrapper
      steps={steps}
      run={run}
      onEvent={handleJoyrideEvent}
    />
  );
};
