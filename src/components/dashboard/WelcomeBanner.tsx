import { Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function WelcomeBanner() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "Founder";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-[#222] bg-[#10120f] p-6 md:p-8 mb-8 mt-2">
      {/* Subtle Green Grid Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.20]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #22c55e 1px, transparent 1px),
            linear-gradient(to bottom, #22c55e 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
          maskImage:
            "linear-gradient(to bottom right, black 20%, transparent 80%)",
          WebkitMaskImage:
            "linear-gradient(to bottom right, black 20%, transparent 80%)",
        }}
      />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Here's what's happening with your decks today.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Link to="/rooms" className="flex-1 md:flex-none">
            <button className="w-full md:w-auto h-9 px-4 bg-[#10120f] border border-[#333] text-slate-200 text-sm font-medium rounded-md hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-2">
              View Rooms
            </button>
          </Link>
          <Link to="/upload" className="flex-1 md:flex-none">
            <button className="w-full md:w-auto h-9 px-4 bg-deckly-primary text-slate-950 text-sm font-medium rounded-md hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 shadow-sm">
              <Upload size={14} />
              New Deck
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
