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
  const [isReady, setIsReady] = React.useState(false);
  const hasDecks = decks.length > 0;

  // Wait for the table to render and targets to be TRULY available and visible
  React.useEffect(() => {
    let checkInterval: number;
    
    const checkForTargets = () => {
      const target = document.querySelector('[data-tour="analytics-btn"]') as HTMLElement;
      // Also check for the class just in case data-tour is missing
      const fallback = document.querySelector(".tour-analytics-btn") as HTMLElement;
      
      if ((target || fallback) && hasDecks && (target?.offsetParent !== null || fallback?.offsetParent !== null)) {
        setIsReady(true);
        clearInterval(checkInterval);
      }
    };

    // Initial delay + interval check
    const timeout = setTimeout(() => {
      checkInterval = window.setInterval(checkForTargets, 500);
    }, 1500); // 1.5s delay to be safe

    return () => {
      clearTimeout(timeout);
      clearInterval(checkInterval);
    };
  }, [hasDecks]);

  const isTourComplete = hasCompletedTour("content_completed");
  
  // Trigger only if there's at least one deck rendered on the table,
  // tour is not complete, and we've verified the DOM targets are visible.
  const run = !isTourComplete && hasDecks && isReady;

  const steps: Step[] = useMemo(
    () => [
      {
        target: '[data-tour="analytics-btn"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Next Step: Analytics 📊</h3>
            <p className="text-slate-300 text-sm">
              Great job uploading! Now, click here to see your <strong>Analytics</strong>. 
              Find out exactly which slide is losing you investors.
            </p>
          </div>
        ),
        placement: "bottom" as const,
        disableBeacon: true,
        disableScrolling: true, // Bypass Joyride visibility/scroll calculations
      },
      {
        target: '[data-tour="edit-btn"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Non-Destructive Edits</h3>
            <p className="text-slate-300 text-sm">
              Fixed a typo? Update the file here. 
              The link stays exactly the same—no need to resend emails!
            </p>
          </div>
        ),
        placement: "bottom" as const,
        disableScrolling: true,
      },
      {
        target: '[data-tour="delete-btn"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Complete Control</h3>
            <p className="text-slate-300 text-sm">
              Close the round? Delete the deck to revoke all public access instantly.
            </p>
          </div>
        ),
        placement: "bottom-end" as const,
        disableScrolling: true,
      },
    ],
    []
  );

  const handleJoyrideEvent = (data: EventData) => {
    const { status, action } = data;
    
    // Only mark as complete if the user actually finished or skipped it manually.
    // If it was skipped automatically because of visibility issues, 'action' would be 'start' or 'update' usually.
    if (status === STATUS.FINISHED || (status === STATUS.SKIPPED && action === "close")) {
      markTourComplete("content_completed");
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
