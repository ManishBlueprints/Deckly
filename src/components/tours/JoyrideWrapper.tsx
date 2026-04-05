import React from "react";
import { Joyride, EventData, Step } from "react-joyride";

interface JoyrideWrapperProps {
  steps: Step[];
  run: boolean;
  onEvent?: (data: EventData) => void;
  continuous?: boolean;
  scrollToFirstStep?: boolean;
  showProgress?: boolean;
  showSkipButton?: boolean;
}

export const JoyrideWrapper: React.FC<JoyrideWrapperProps> = ({
  steps,
  run,
  onEvent,
  continuous = true,
  scrollToFirstStep = true,
  showProgress = false,
  showSkipButton = true,
}) => {
  return (
    <Joyride
      steps={steps}
      run={run}
      onEvent={onEvent}
      continuous={continuous}
      scrollToFirstStep={scrollToFirstStep}
      styles={{
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
      options={{
        arrowColor: "#2a2a2a", // surface-high
        backgroundColor: "#2a2a2a",
        overlayColor: "rgba(0, 0, 0, 0.6)",
        primaryColor: "#54e98a",
        textColor: "#e5e2e1",
        zIndex: 10000,
        showProgress,
        buttons: showSkipButton 
          ? ['back', 'close', 'primary', 'skip'] 
          : ['back', 'close', 'primary'],
      }}
    />
  );
};
