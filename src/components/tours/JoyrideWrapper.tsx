import React from "react";
import { Joyride, EventData, Step, Styles } from "react-joyride";

interface JoyrideWrapperProps {
  steps: Step[];
  run: boolean;
  onEvent?: (data: EventData) => void;
  continuous?: boolean;
  scrollToFirstStep?: boolean;
  stepIndex?: number;
  locale?: Record<string, string>;
  debug?: boolean;
}

export const JoyrideWrapper: React.FC<JoyrideWrapperProps> = ({
  steps,
  run,
  onEvent,
  continuous = true,
  scrollToFirstStep = true,
  stepIndex,
  locale,
  debug,
}) => {
  // Memoize steps to inject skipBeacon natively if not present
  const processedSteps: Step[] = React.useMemo(
    () =>
      steps.map((step) => ({
        ...step,
        // react-joyride v3 uses skipBeacon, whereas older/other versions used disableBeacon.
        // We support both here and default to true to avoid hidden beacons.
        skipBeacon:
          (step as Record<string, unknown>).skipBeacon !== undefined
            ? !!(step as Record<string, unknown>).skipBeacon
            : (step as Record<string, unknown>).disableBeacon !== undefined
              ? !!(step as Record<string, unknown>).disableBeacon
              : true,
      })),
    [steps]
  );

  return (
    <Joyride
      steps={processedSteps}
      run={run}
      onEvent={onEvent}
      continuous={continuous}
      scrollToFirstStep={scrollToFirstStep}
      stepIndex={stepIndex}
      locale={{
        last: "Finish",
        ...locale,
      }}
      // Cast the entire styles object to Styles to satisfy strict typing
      // while using the structure supported by our current react-joyride version
      styles={
        {
          options: {
            arrowColor: "#2a2a2a",
            backgroundColor: "#2a2a2a",
            overlayColor: "rgba(0, 0, 0, 0.75)",
            primaryColor: "#54e98a",
            textColor: "#e5e2e1",
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: "12px",
            padding: "24px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backgroundColor: "#1a1a1a",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          },
          buttonPrimary: {
            borderRadius: "8px",
            fontWeight: 700,
            backgroundColor: "#54e98a",
            color: "#000000",
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "10px 20px",
          },
          buttonBack: {
            color: "#bbcbbb",
            fontSize: "12px",
            fontWeight: 600,
            marginRight: "12px",
          },
          buttonSkip: {
            color: "#bbcbbb",
            fontSize: "12px",
            fontWeight: 600,
          },
          beacon: {
            display: "none",
          },
        } as Partial<Styles>
      }
      debug={debug}
    />
  );
};
