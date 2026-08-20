import React from "react";
import { Joyride, EventData, Step, Styles } from "react-joyride";
import { useTheme } from "../../contexts/ThemeContext";

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
  const { theme } = useTheme();

  const semanticStyles = (() => {
    const root = getComputedStyle(document.documentElement);
    const color = (token: string, alpha?: number) => {
      const channels = root.getPropertyValue(token).trim();
      return alpha === undefined ? `rgb(${channels})` : `rgb(${channels} / ${alpha})`;
    };

    return {
      elevated: color("--ui-surface-elevated"),
      text: color("--ui-text"),
      muted: color("--ui-text-muted"),
      border: color("--ui-border"),
      primary: color("--ui-primary"),
      primaryText: color("--ui-primary-text"),
      scrim: color("--ui-scrim", 0.72),
      shadow: root.getPropertyValue("--ui-shadow-overlay").trim(),
      zIndex: Number(root.getPropertyValue("--ui-layer-tour")) || 80,
    };
  })();
  void theme;

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
            arrowColor: semanticStyles.elevated,
            backgroundColor: semanticStyles.elevated,
            overlayColor: semanticStyles.scrim,
            primaryColor: semanticStyles.primary,
            textColor: semanticStyles.text,
            zIndex: semanticStyles.zIndex,
          },
          tooltip: {
            borderRadius: "12px",
            padding: "24px",
            border: `1px solid ${semanticStyles.border}`,
            backgroundColor: semanticStyles.elevated,
            boxShadow: semanticStyles.shadow,
          },
          buttonPrimary: {
            borderRadius: "8px",
            fontWeight: 700,
            backgroundColor: semanticStyles.primary,
            color: semanticStyles.primaryText,
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "10px 20px",
          },
          buttonBack: {
            color: semanticStyles.muted,
            fontSize: "12px",
            fontWeight: 600,
            marginRight: "12px",
          },
          buttonSkip: {
            color: semanticStyles.muted,
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
