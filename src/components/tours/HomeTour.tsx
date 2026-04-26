import React, { useMemo, useState, useEffect } from "react";
import { EventData, STATUS, Step } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";
import { useAuth } from "../../contexts/AuthContext";

interface HomeTourProps {
  deckCount: number;
}

export const HomeTour: React.FC<HomeTourProps> = ({ deckCount }) => {
  useAuth();
  const { hasCompletedTour, markTourComplete } = useTourState();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkTarget = () => {
      const uploadBtn = document.querySelector("#tour-upload-deck-btn");

      if (uploadBtn) {
        setIsReady(true);
        return true;
      }
      return false;
    };

    if (checkTarget()) return;

    const interval = setInterval(() => {
      if (checkTarget()) clearInterval(interval);
    }, 200);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [deckCount, isReady]);

  const isTourComplete = hasCompletedTour("home_completed");
  const run = !isTourComplete && isReady;

  const activeStep: Step[] = useMemo(() => {
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
        skipBeacon: true,
        spotlightClicks: true,
      },
    ];
  }, []);

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      markTourComplete("home_completed");
    }
  };

  return (
    <JoyrideWrapper
      key="home-tour"
      steps={activeStep}
      run={run}
      onEvent={handleJoyrideEvent}
      debug={false}
    />
  );
};
