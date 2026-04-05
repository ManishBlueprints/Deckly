import React, { useMemo } from "react";
import { EventData, Step, STATUS } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";

export const DashboardTour: React.FC = () => {
  const { hasCompletedTour, markTourComplete } = useTourState();
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const exists = !!document.querySelector('[data-tour="stat-card-0"]');
      if (exists) setIsReady(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const isTourComplete = hasCompletedTour("dashboard_completed");
  const run = !isTourComplete && isReady;

  const steps: Step[] = useMemo(
    () => [
      {
        target: '[data-tour="stat-card-0"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Total Visits</h3>
            <p className="text-slate-300 text-sm">
              This shows the total number of unique visits across all your active decks.
            </p>
          </div>
        ),
        placement: "right",
        disableBeacon: true,
      },
      {
        target: '[data-tour="stat-card-1"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Time Spent</h3>
            <p className="text-slate-300 text-sm">
              Track how much time investors are spending interacting with your content.
            </p>
          </div>
        ),
        placement: "right",
        disableBeacon: true,
      },
      {
        target: '[data-tour="stat-card-2"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Total Saves</h3>
            <p className="text-slate-300 text-sm">
              See how many times your decks have been saved for later review.
            </p>
          </div>
        ),
        placement: "right",
        disableBeacon: true,
      },
      {
        target: '[data-tour="engagement-chart"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Engagement Over Time</h3>
            <p className="text-slate-300 text-sm">
              This chart visualizes your activity over the last 7 days. Switch between Visits, Duration, and Saves to see detailed daily breakdowns.
            </p>
          </div>
        ),
        placement: "left",
        disableBeacon: true,
      },
      {
        target: '[data-tour="top-decks"]',
        content: (
          <div className="text-left space-y-4">
            <h3 className="text-xl font-bold text-white mb-2">Top Performing Decks</h3>
            <p className="text-slate-300 text-sm">
              Quickly identify which assets are gaining the most traction in your portfolio.
            </p>
          </div>
        ),
        placement: "top",
        disableBeacon: true,
      },
    ],
    []
  );

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      markTourComplete("dashboard_completed");
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
