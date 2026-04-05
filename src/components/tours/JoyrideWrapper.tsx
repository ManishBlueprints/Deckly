import React from "react";
import { Joyride, EventData, Step } from "react-joyride";

interface JoyrideWrapperProps {
  steps: Step[];
  run: boolean;
  onEvent?: (data: EventData) => void;
  continuous?: boolean;
  scrollToFirstStep?: boolean;
  stepIndex?: number; // Add support for controlled index
  locale?: Record<string, string>;
}

export const JoyrideWrapper: React.FC<JoyrideWrapperProps> = ({
  steps,
  run,
  onEvent,
  continuous = true,
  scrollToFirstStep = true,
  stepIndex,
  locale,
}) => {
  // Explicitly inject disableBeacon into every step to ensure tooltips show directly
  const processedSteps = steps.map(step => ({
    ...step,
    disableBeacon: true
  }));

  // Workaround for react-joyride dropping disableBeacon on init in certain renders:
  // Automatically click the beacon immediately when it appears.
  React.useEffect(() => {
    if (!run) return;

    // Centralized selector for the react-joyride beacon
    const BEACON_SELECTOR = 'button[aria-label="Open the dialog"], button[title="Open the dialog"]';

    const attemptClick = () => {
      const beacon = document.querySelector(BEACON_SELECTOR) as HTMLButtonElement;
      if (beacon) {
        beacon.click();
        return true;
      }
      return false;
    };

    // Check immediately if it's already mounted
    if (attemptClick()) return;

    // Use MutationObserver for instant detection without the overhead of polling
    const observer = new MutationObserver(() => {
      if (attemptClick()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    // Safety timeout to prevent long-running observers if beacon fails to appear
    const safetyTimeout = setTimeout(() => {
      observer.disconnect();
    }, 3000);

    return () => {
      observer.disconnect();
      clearTimeout(safetyTimeout);
    };
  }, [run, stepIndex]);

  return (
    <Joyride
      steps={processedSteps}
      run={run}
      onEvent={onEvent}
      continuous={continuous}
      scrollToFirstStep={scrollToFirstStep}
      stepIndex={stepIndex} // Pass through the controlled index
      // @ts-expect-error - Property name varies across versions, but explicitly setting it helps in some v3 envs
      disableBeacon={true}
      locale={{
        last: "Finish", // Default
        ...locale,
      }}
      styles={{
        beaconInner: {
          display: "none",
        },
        beaconOuter: {
          display: "none",
        },
        tooltip: {
          borderRadius: "0px", // Sharp corners as per global CSS
          padding: "20px",
          border: "1px solid rgba(255, 255, 255, 0.05)",
        },
        buttonPrimary: {
          borderRadius: "0px",
          fontWeight: 600,
          backgroundColor: "#54e98a",
          color: "#000000",
        },
        buttonBack: {
          color: "#c8c6c5",
        },
        buttonSkip: {
          color: "#c8c6c5",
        },
      }}
      debug={false}
      options={{
        arrowColor: "#2a2a2a", // surface-high
        backgroundColor: "#2a2a2a",
        overlayColor: "rgba(0, 0, 0, 0.6)",
        primaryColor: "#54e98a",
        textColor: "#e5e2e1",
        zIndex: 10000,
      }}
    />
  );
};
