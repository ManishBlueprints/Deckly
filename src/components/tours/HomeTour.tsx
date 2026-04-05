import React, { useMemo } from "react";
import { EventData, Step, EVENTS, STATUS } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";

export const HomeTour: React.FC = () => {
  const { hasCompletedTour, markTourComplete } = useTourState();

  const isTourComplete = hasCompletedTour("home_completed");
  const run = !isTourComplete;

  const steps: Step[] = useMemo(
    () => [
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
      },
      {
        target: "body",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Wait for the Magic</h3>
            <div className="p-4 bg-deckly-background rounded-xl border border-white/10 text-center">
              <div className="w-12 h-12 relative mx-auto mb-2">
                <div className="absolute inset-0 border-4 border-[#54e98a]/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-[#54e98a] rounded-full animate-spin"></div>
              </div>
              <p className="text-[#54e98a] text-sm font-bold">Uploading...</p>
            </div>
            <p className="text-slate-300 text-sm mt-4">
              We convert each slide so it's perfectly crisp on any device.
            </p>
          </div>
        ),
        placement: "center",
      },
      {
        target: "body",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Success! ✨</h3>
            <div className="p-4 bg-deckly-background rounded-xl border border-[#54e98a]/30 text-center">
              <div className="w-12 h-12 bg-[#54e98a]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-[#54e98a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[#54e98a] text-sm font-bold">Successfully Uploaded!</p>
            </div>
            <p className="text-slate-300 text-sm mt-4">
              Your deck is now a secure, trackable link. You'll be able to see exactly who views it and for how long.
            </p>
          </div>
        ),
        placement: "center",
      },
      {
        target: "#tour-upload-deck-btn",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Ready to Start?</h3>
            <p className="text-slate-300 text-sm">
              Now it's your turn! Click the <strong>Upload Deck</strong> button to share your first presentation.
            </p>
          </div>
        ),
        placement: "bottom",
      },
    ],
    []
  );

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      markTourComplete("home_completed");
    }
  };

  if (!run) return null;

  return (
    <JoyrideWrapper
      steps={steps}
      run={run}
      onEvent={handleJoyrideEvent}
    />
  );
};
