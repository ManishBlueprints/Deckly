import React, { useMemo } from "react";
import { EventData, Step, STATUS } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";
import { useDecks } from "../../hooks/useDecks";
import { useAuth } from "../../contexts/AuthContext";

export const ContentTour: React.FC = () => {
  const { session } = useAuth();
  const { data: decks = [] } = useDecks(session?.user?.id);
  const { hasCompletedTour, markTourComplete } = useTourState();

  const isTourComplete = hasCompletedTour("content_completed");
  const hasDecks = decks.length > 0;
  // Trigger only if there's at least one deck rendered on the table and tour is not complete
  const run = !isTourComplete && hasDecks;

  const steps: Step[] = useMemo(
    () => [
      {
        target: ".tour-analytics-btn",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Next Step: Analytics 📊</h3>
            <p className="text-slate-300 text-sm">
              Great job uploading! Now, click here to see your <strong>Analytics</strong>. 
              Find out exactly which slide is losing you investors.
            </p>
          </div>
        ),
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: ".tour-edit-btn",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Non-Destructive Edits</h3>
            <p className="text-slate-300 text-sm">
              Fixed a typo? Update the file here. 
              The link stays exactly the same—no need to resend emails!
            </p>
          </div>
        ),
        placement: "bottom",
      },
      {
        target: ".tour-delete-btn",
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Complete Control</h3>
            <p className="text-slate-300 text-sm">
              Close the round? Delete the deck to revoke all public access instantly.
            </p>
          </div>
        ),
        placement: "bottom-end",
      },
    ],
    []
  );

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      markTourComplete("content_completed");
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
