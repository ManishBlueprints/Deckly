import React, { useMemo } from "react";
import { EventData, Step, STATUS } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";

interface DataRoomCreateTourProps {
  isEditMode?: boolean;
}

export const DataRoomCreateTour: React.FC<DataRoomCreateTourProps> = ({ isEditMode }) => {
  const { hasCompletedTour, markTourComplete } = useTourState();
  const [isReady, setIsReady] = React.useState(false);

  // ONLY run if we are in CREATE mode (not edit) and they haven't finished this part yet
  const isTourComplete = hasCompletedTour("data_room_create_completed");
  
  // Wait for the form to be stable
  React.useEffect(() => {
    if (isEditMode) return;
    
    const checkTimer = setTimeout(() => {
      const target = document.querySelector('[data-tour="room-branding"]');
      if (target) setIsReady(true);
    }, 1000);
    
    return () => clearTimeout(checkTimer);
  }, [isEditMode]);

  const run = !isTourComplete && !isEditMode && isReady;

  const steps: Step[] = useMemo(
    () => [
      {
        target: '[data-tour="room-branding"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Identify Your Room 🏷️</h3>
            <p className="text-slate-300 text-sm">
              Give your data room a professional name and a clean internal URL. You can also upload a logo to make it feel on-brand.
            </p>
          </div>
        ),
        placement: "bottom",
        disableBeacon: true,
        disableScrolling: true,
      },
      {
        target: '[data-tour="room-assets"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Bundle Assets 📎</h3>
            <p className="text-slate-300 text-sm">
              Click <strong>Add Assets</strong> to pick documents from your library. You can reorder them to tell your story in the right sequence.
            </p>
          </div>
        ),
        placement: "bottom",
        disableBeacon: true,
        disableScrolling: true,
      },
      {
        target: '[data-tour="room-security"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Elite Security 🛡️</h3>
            <p className="text-slate-300 text-sm">
              This is where the magic happens. 
              <strong> Require Email</strong> to build a lead list, or <strong>Set a Passcode</strong> for high-stakes investor updates. 
              You can even add an expiry date to create urgency.
            </p>
          </div>
        ),
        placement: "top",
        disableBeacon: true,
        disableScrolling: true,
      },
    ],
    []
  );

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      markTourComplete("data_room_create_completed");
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
