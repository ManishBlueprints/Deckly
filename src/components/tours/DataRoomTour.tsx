import React, { useMemo } from "react";
import { EventData, Step, STATUS } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";

export const DataRoomTour: React.FC = () => {
  const { hasCompletedTour, markTourComplete } = useTourState();

  const isTourComplete = hasCompletedTour("data_room_completed");
  const run = !isTourComplete;

  const steps: Step[] = useMemo(
    () => [
      {
        target: '[data-tour="new-room-btn"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Create a Data Room</h3>
            <p className="text-slate-300 text-sm">
              Data rooms let you bundle multiple decks and files into one secure space. 
              Click here to create your first.
            </p>
          </div>
        ),
        placement: "bottom",
        disableBeacon: true,
        spotlightClicks: true, // Allow clicking the actual button
        buttons: ["back"], // Show only back, no next/last
      },
    ],
    []
  );

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      markTourComplete("data_room_completed");
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
