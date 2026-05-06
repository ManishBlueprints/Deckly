import { useEffect, useMemo } from "react";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { buildTallyEmbedUrl } from "../utils/tally";

const FEEDBACK_URL = import.meta.env.VITE_TALLY_FEEDBACK_URL?.trim();
const TALLY_EMBED_SCRIPT = "https://tally.so/widgets/embed.js";

function FeedbackPage() {
  const { session, profile, branding } = useAuth();

  const tallyUrl = useMemo(() => {
    if (!FEEDBACK_URL) return null;

    try {
      return buildTallyEmbedUrl(FEEDBACK_URL, {
        email: session?.user?.email ?? "",
        name: profile?.full_name ?? "",
        user_id: session?.user?.id ?? "",
        handle: profile?.handle ?? "",
        workspace: branding?.room_name ?? "",
        source: "deckly-app",
        page: "/feedback",
      });
    } catch {
      return null;
    }
  }, [
    branding?.room_name,
    profile?.full_name,
    profile?.handle,
    session?.user?.email,
    session?.user?.id,
  ]);

  useEffect(() => {
    if (!tallyUrl) return;

    const existingWindow = window as Window & {
      Tally?: { loadEmbeds: () => void };
    };

    if (existingWindow.Tally) {
      existingWindow.Tally.loadEmbeds();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${TALLY_EMBED_SCRIPT}"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        existingWindow.Tally?.loadEmbeds();
      });
      return;
    }

    const script = document.createElement("script");
    script.src = TALLY_EMBED_SCRIPT;
    script.async = true;
    script.onload = () => {
      existingWindow.Tally?.loadEmbeds();
    };
    document.body.appendChild(script);
  }, [tallyUrl]);

  return (
    <DashboardLayout title="Help & Feedback" showFab={false}>
      <div className="max-w-5xl mx-auto space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="border border-white/10 bg-surface-low px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Help & Feedback
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Use this form for problems, feature suggestions, and improvement
              requests. Your account details are passed through automatically.
            </p>
          </div>
        </section>

        <section className="border border-white/10 bg-surface-low p-3 sm:p-4">
          <div className="w-full bg-surface-low">
            {tallyUrl ? (
              <iframe
                data-tally-src={tallyUrl}
                title="Help and feedback form"
                loading="lazy"
                width="100%"
                height="100%"
                frameBorder="0"
                marginHeight={0}
                marginWidth={0}
                className="h-[calc(100vh-14rem)] min-h-[760px] w-full border-0 bg-white"
              />
            ) : (
              <div className="flex min-h-[520px] flex-col items-start justify-center px-2 py-12 text-left">
                <h2 className="text-base font-medium text-white">
                  Connect a Tally form to turn this page on
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
                  Set{" "}
                  <code className="rounded bg-white/5 px-1.5 py-0.5 text-slate-200">
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
    </DashboardLayout>
  );
}

export default FeedbackPage;
