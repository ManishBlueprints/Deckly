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
      content:
        "First, select your pitch deck or document here. We support PDF, PPTX, and more!",
      placement: "bottom",
    },
    {
      target: "#tour-security-panel",
      content:
        "Next, set up your security. You can require emails, add passwords, or set an expiration date.",
      placement: "top",
    },
    {
      target: "#tour-upload-finalize",
      content:
        "Once you're ready, click here to finalize and upload your deck!",
      placement: "top",
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
