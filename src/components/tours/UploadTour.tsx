import { Step, EventData, STATUS } from "react-joyride";
import { JoyrideWrapper } from "./JoyrideWrapper";
import { useTourState } from "../../contexts/TourContext";
import { useDecks } from "../../hooks/useDecks";
import { useAuth } from "../../contexts/AuthContext";

export function UploadTour() {
  const { hasCompletedTour, markTourComplete } = useTourState();
  const { session } = useAuth();
  const { isLoading } = useDecks(session?.user?.id);

  // Only show if user hasn't completed the upload tour
  const shouldRun = !isLoading && !hasCompletedTour("upload_completed");

  const steps: Step[] = [
    {
      target: "#tour-upload-dropzone",
      content: (
        <div className="text-left space-y-4">
          <h3 className="text-xl font-bold text-white mb-2">
            Upload Your Document
          </h3>
          <p className="text-slate-300 text-sm">
            First, select your pitch deck or document here. We support{" "}
            <strong>PDF, PPTX, and more</strong>!
          </p>
        </div>
      ),
      placement: "bottom",
      skipBeacon: true,
    },
    {
      target: "#tour-security-panel",
      content: (
        <div className="text-left space-y-4">
          <h3 className="text-xl font-bold text-white mb-2">
            Secure Your Assets
          </h3>
          <p className="text-slate-300 text-sm">
            Next, set up your security. You can <strong>require emails</strong>,
            add <strong>passwords</strong>, or set an expiration date.
          </p>
        </div>
      ),
      placement: "top",
      skipBeacon: true,
    },
    {
      target: "#tour-upload-finalize",
      content: (
        <div className="text-left space-y-4">
          <h3 className="text-xl font-bold text-white mb-2">Ready to Go?</h3>
          <p className="text-slate-300 text-sm">
            Once you're ready, click here to finalize and{" "}
            <strong>upload your deck</strong>!
          </p>
        </div>
      ),
      placement: "top",
      skipBeacon: true,
    },
  ];

  const handleJoyrideEvent = (data: EventData) => {
    const { status } = data;
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      markTourComplete("upload_completed");
    }
  };

  return (
    <JoyrideWrapper
      steps={steps}
      run={shouldRun}
      onEvent={handleJoyrideEvent}
      continuous
    />
  );
}
