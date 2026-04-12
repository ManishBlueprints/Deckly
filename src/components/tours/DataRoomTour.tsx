import React, { useMemo } from "react";
import { EventData, Step, STATUS } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";

interface DataRoomTourProps {
  hasRooms: boolean;
  isLoading: boolean;
}

export const DataRoomTour: React.FC<DataRoomTourProps> = ({
  hasRooms,
  isLoading,
}) => {
  const { hasCompletedTour, markTourComplete } = useTourState();

  const isTourComplete = hasCompletedTour("data_room_completed");

  React.useEffect(() => {
    // If they already created a room, quietly mark the tour as complete so it doesn't pop up
    if (hasRooms && !isTourComplete) {
      markTourComplete("data_room_completed");
    }
  }, [hasRooms, isTourComplete, markTourComplete]);

  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !hasRooms && !isTourComplete) {
      const checkElement = () => {
        const exists = !!document.querySelector('[data-tour="new-room-btn"]');
        if (exists) {
          setIsReady(true);
          return true;
        }
        return false;
      };

      if (checkElement()) return;

      const interval = setInterval(() => {
        if (checkElement()) clearInterval(interval);
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [isLoading, hasRooms, isTourComplete]);

  const run = !isTourComplete && !hasRooms && isReady;

  const steps: Step[] = useMemo(
    () => [
      {
        target: '[data-tour="new-room-btn"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">
              Create a Data Room
            </h3>
            <p className="text-slate-300 text-sm">
              Data rooms let you bundle multiple decks and files into one secure
              space. Click here to create your first.
            </p>
          </div>
        ),
        placement: "bottom",
        disableBeacon: true,
        spotlightClicks: true, // Allow clicking the actual button
        buttons: ["back"], // Show only back, no next/last
      },
    ],
    [],
  );

  const handleJoyrideEvent = React.useCallback(
    (data: EventData) => {
      const { status } = data;

      if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
        markTourComplete("data_room_completed");
      }
    },
    [markTourComplete],
  );

  if (!run) return null;

  return (
    <JoyrideWrapper steps={steps} run={run} onEvent={handleJoyrideEvent} />
  );
};
