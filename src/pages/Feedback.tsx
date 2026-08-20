import { useEffect } from "react";
import { WorkspaceShell } from "../components/layout/WorkspaceShell";
import { buildTallyEmbedUrl } from "../utils/tally";

const FEEDBACK_URL = import.meta.env.VITE_TALLY_FEEDBACK_URL?.trim();
const TALLY_EMBED_SCRIPT = "https://tally.so/widgets/embed.js";

function FeedbackPage() {
  let tallyUrl: string | null = null;

  if (FEEDBACK_URL) {
    try {
      tallyUrl = buildTallyEmbedUrl(FEEDBACK_URL, {
        source: "deckly-app",
        page: "/feedback",
      });
    } catch {
      tallyUrl = null;
    }
  }

  useEffect(() => {
    if (!tallyUrl) return;

    const existingWindow = window as Window & {
      Tally?: { loadEmbeds: () => void };
    };
    const handleScriptLoad = () => {
      existingWindow.Tally?.loadEmbeds();
    };

    if (existingWindow.Tally) {
      existingWindow.Tally.loadEmbeds();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${TALLY_EMBED_SCRIPT}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", handleScriptLoad, { once: true });
      return () => {
        existingScript.removeEventListener("load", handleScriptLoad);
      };
    }

    const script = document.createElement("script");
    script.src = TALLY_EMBED_SCRIPT;
    script.async = true;
    script.addEventListener("load", handleScriptLoad, { once: true });
    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", handleScriptLoad);
    };
  }, [tallyUrl]);

  return (
    <WorkspaceShell title="Help & Feedback">
      <div className="max-w-5xl mx-auto space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="border border-ui-border bg-ui-surface px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ui-text">
              Help & Feedback
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-ui-muted">
              Use this form for problems, feature suggestions, and improvement
              requests. We&apos;ll use the details you enter in the form when we
              follow up.
            </p>
          </div>
        </section>

        <section className="border border-ui-border bg-ui-surface p-3 sm:p-4">
          <div className="w-full bg-surface-low">
            {tallyUrl ? (
              <iframe
                src={tallyUrl}
                data-tally-src={tallyUrl}
                title="Help and feedback form"
                loading="lazy"
                sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
                allow="fullscreen; clipboard-write"
                referrerPolicy="no-referrer"
                width="100%"
                height="100%"
                frameBorder="0"
                marginHeight={0}
                marginWidth={0}
                className="h-[calc(100vh-14rem)] min-h-[760px] w-full border-0 bg-ui-surface"
              />
            ) : (
              <div className="flex min-h-[520px] flex-col items-start justify-center px-2 py-12 text-left">
                <h2 className="text-base font-medium text-ui-text">
                  Connect a Tally form to turn this page on
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ui-muted">
                  Set{" "}
                  <code className="rounded bg-ui-subtle px-1.5 py-0.5 text-ui-text">
                    VITE_TALLY_FEEDBACK_URL
                  </code>{" "}
                  in your environment, then add hidden fields for the values
                  you want Make.com to receive.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

export default FeedbackPage;
