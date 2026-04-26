import React, { useEffect, useMemo, useState } from "react";
import { EventData, STATUS, Step } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useAuth } from "../../contexts/AuthContext";
import { isWorkspaceSetupComplete } from "../../utils/onboarding";

export const WorkspaceOnboardingTour: React.FC = () => {
  const { profile, branding } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkTargets = () => {
      const nameInput = document.querySelector("#tour-workspace-name");
      const slugInput = document.querySelector("#tour-workspace-slug");
      if (nameInput && slugInput) {
        setIsReady(true);
        return true;
      }
      return false;
    };

    if (checkTargets()) return;

    const interval = setInterval(() => {
      if (checkTargets()) clearInterval(interval);
    }, 150);

    const timeout = setTimeout(() => clearInterval(interval), 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const run = !isWorkspaceSetupComplete(profile, branding) && isReady;

  const steps: Step[] = useMemo(
    () => [
      {
        target: "#tour-workspace-name",
        content: (
          <div className="text-left space-y-3">
            <h3 className="text-xl font-bold text-white">Name your workspace</h3>
            <p className="text-slate-300 text-sm">
              Use the company or team name you want people to recognize when
              they see shared links.
            </p>
          </div>
        ),
        placement: "right",
        disableBeacon: true,
      },
      {
        target: "#tour-workspace-slug",
        content: (
          <div className="text-left space-y-3">
            <h3 className="text-xl font-bold text-white">Set your URL slug</h3>
            <p className="text-slate-300 text-sm">
              This becomes your public workspace link. Keep it short and easy to
              share.
            </p>
          </div>
        ),
        placement: "right",
        disableBeacon: true,
      },
    ],
    [],
  );

  const handleEvent = (data: EventData) => {
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(data.status)) {
      setIsReady(false);
    }
  };

  if (!run) return null;

  return <JoyrideWrapper steps={steps} run={run} onEvent={handleEvent} />;
};
