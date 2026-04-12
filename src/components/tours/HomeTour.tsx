import React, { useMemo, useState, useEffect } from "react";
import { EventData, STATUS, Step } from "react-joyride";
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
  const [currentStage, setCurrentStage] = useState(0);

  // 1. Wait for components to animate in and DOM to stabilize
  useEffect(() => {
    const checkTarget = () => {
      const targetExists =
        !!document.querySelector("#tour-upload-deck-btn") &&
        !!document.querySelector("#tour-workspace-settings");
      if (targetExists) {
        setIsReady(true);
        return true;
      }
      return false;
    };

    if (checkTarget()) return;

    const interval = setInterval(() => {
      if (checkTarget()) clearInterval(interval);
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [deckCount]);

  // 3. Listen for modal closure to advance tour
  useEffect(() => {
    const handleClose = () => {
      if (currentStage === 0) {
        setCurrentStage(1);
      }
    };
    window.addEventListener("deckly:settings-closed", handleClose);
    return () =>
      window.removeEventListener("deckly:settings-closed", handleClose);
  }, [currentStage]);

  const isTourComplete = hasCompletedTour("home_completed");
  const run = !!profile?.handle && !isTourComplete && isReady;

  // Split steps to act as separate uncontrolled tours.
  // This physically works around react-joyride's controlled bug keeping the beacon active.
  const activeStep: Step[] = useMemo(() => {
    if (currentStage === 0) {
      return [
        {
          target: "#tour-workspace-settings",
          content: (
            <div className="text-left space-y-4">
              <h3 className="text-xl font-bold text-white mb-2">
                Setup Your Workspace Name
              </h3>
              <p className="text-slate-300 text-sm">
                Click here to change your
                <strong> Workspace Name</strong> and upload your{" "}
                <strong>Company Logo</strong>.
              </p>
            </div>
          ),
          placement: "right" as const,
          disableBeacon: true,
          spotlightClicks: true,
          disableOverlayClose: true,
          // Instead of typical 'Next', maybe we don't have back/next. But we can show it for UX.
        },
      ];
    }

    // Stage 1
    return [
      {
        target: "#tour-upload-deck-btn",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">
              Upload Your First Deck
            </h3>
            <p className="text-slate-300 text-sm">
              Welcome! Start by uploading your pitch deck (PDF or PPTX). We'll
              instantly turn it into a trackable, professional link.
            </p>
          </div>
        ),
        placement: "bottom" as const,
        disableBeacon: true,
        spotlightClicks: true,
      },
    ];
  }, [currentStage]);

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;

    // Handle manual clicks: if it's stage 0 and they click next/open (which evaluates to FINISHED on a 1-step tour)
    if (currentStage === 0 && status === STATUS.FINISHED) {
      window.dispatchEvent(new CustomEvent("deckly:open-settings"));
    }

    // If it's stage 1 and finished, mark complete
    if (
      currentStage === 1 &&
      ([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)
    ) {
      markTourComplete("home_completed");
    }

    // If user skips entirely on stage 0 via close button
    if (currentStage === 0 && status === STATUS.SKIPPED) {
      markTourComplete("home_completed");
    }
  };

  return (
    <JoyrideWrapper
      key={`home-tour-stage-${currentStage}`} // Force unmount/remount to cleanly start uncontrolled tour
      steps={activeStep}
      run={run}
      onEvent={handleJoyrideEvent}
      locale={currentStage === 0 ? { last: "Open" } : undefined}
    />
  );
};
