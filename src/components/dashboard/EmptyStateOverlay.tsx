import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  ShieldCheck,
  LineChart,
  Layers,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Palette,
  ArrowRight,
} from "lucide-react";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";

const tutorialSteps = [
  {
    icon: LineChart,
    title: "Deep Analytics",
    description:
      "Track every click. See exactly which slides investors spent the most time on and get real-time view alerts.",
    color: "text-emerald-500",
    glow: "bg-emerald-500/20",
  },
  {
    icon: ShieldCheck,
    title: "Ironclad Security",
    description:
      "Protect your data with password protection, email gating, and self-destructing links.",
    color: "text-blue-500",
    glow: "bg-blue-500/20",
  },
  {
    icon: Layers,
    title: "Virtual Data Rooms",
    description:
      "Group multiple pitch decks and documents into one professional, namespaced link for your investors.",
    color: "text-violet-500",
    glow: "bg-violet-500/20",
  },
  {
    icon: Palette,
    title: "Custom Branding",
    description:
      "Make it yours. Upload your logo, set your colors, and personalize the viewer experience with your brand.",
    color: "text-deckly-primary",
    glow: "bg-deckly-primary/20",
  },
];

export function EmptyStateOverlay() {
  const [currentStep, setCurrentStep] = useState(0);
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "there";

  // Auto-play the slider
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % tutorialSteps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextStep = () => {
    setCurrentStep((prev) => (prev + 1) % tutorialSteps.length);
  };

  const prevStep = () => {
    setCurrentStep(
      (prev) => (prev - 1 + tutorialSteps.length) % tutorialSteps.length,
    );
  };

  const step = tutorialSteps[currentStep];

  return (
    <div className="relative">
      {/* Greyed-out dashboard ghost behind */}
      <div
        className="absolute inset-0 blur-[4px] opacity-[0.05] pointer-events-none select-none"
        aria-hidden
      >
        <div className="space-y-12 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="bg-white/5 rounded-[32px] border border-white/10 h-64 shadow-2xl" />
            <div className="bg-white/5 rounded-[32px] border border-white/10 h-64 shadow-2xl" />
          </div>
          <div className="bg-white/5 rounded-[32px] border border-white/10 h-80 shadow-2xl" />
        </div>
      </div>

      {/* Overlay content */}
      <div className="relative z-10 flex items-center justify-center py-4 md:py-8 min-h-[calc(100vh-200px)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-2xl mx-auto px-4"
        >
          <div className="bg-[#09090b]/80 backdrop-blur-3xl rounded-[40px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-8 md:p-12 text-center relative overflow-hidden group glass-shiny min-h-[520px] flex flex-col justify-between">
            {/* Dynamic Ambient Glow */}
            <AnimatePresence>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                className={`absolute -top-24 -left-24 w-64 h-64 ${step.glow} rounded-full blur-[100px] pointer-events-none transition-all duration-1000`}
              />
            </AnimatePresence>

            {/* Header Greeting */}
            <div className="relative z-10 space-y-2 mb-2">
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                Welcome, {firstName}! 🚀
              </h2>
              <p className="text-slate-400 text-sm font-medium">
                Let's get your first pitch deck ready for investors.
              </p>
            </div>

            {/* Feature Slider Content */}
            <div className="relative z-10 flex-1 flex flex-col justify-center py-6">
              {/* Floating Navigation Arrows */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none px-2 z-20">
                <button
                  onClick={prevStep}
                  className="p-3 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90 pointer-events-auto shadow-2xl backdrop-blur-md"
                  aria-label="Previous feature"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={nextStep}
                  className="p-3 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-90 pointer-events-auto shadow-2xl backdrop-blur-md"
                  aria-label="Next feature"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <div
                    className={`w-24 h-24 mx-auto rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl relative transition-all group-hover:scale-105 duration-500`}
                  >
                    <step.icon
                      size={44}
                      className={`${step.color} transition-colors duration-500`}
                    />
                    <Sparkles className="absolute -top-2 -right-2 text-deckly-primary opacity-50 w-6 h-6 animate-pulse" />
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight uppercase tracking-[0.1em]">
                      {step.title}
                    </h3>
                    <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto leading-relaxed font-medium px-12">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Pagination & CTA Section */}
            <div className="relative z-10 space-y-8">
              {/* Dots */}
              <div className="flex justify-center gap-2.5">
                {tutorialSteps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      i === currentStep
                        ? "w-10 bg-deckly-primary"
                        : "w-2 bg-white/10 hover:bg-white/20"
                    }`}
                  />
                ))}
              </div>

              {/* Action Bar - Centered */}
              <div className="pt-8 border-t border-white/5 flex justify-center">
                <Link to="/upload" className="w-full max-w-md" id="tour-upload-deck-btn">
                  <Button className="w-full h-14 rounded-2xl bg-deckly-primary hover:bg-deckly-primary/90 text-slate-900 font-bold text-xs uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(34,197,94,0.3)] transition-all active:scale-95 border-none group/btn">
                    <Upload
                      size={18}
                      className="mr-3 transition-transform group-hover/btn:-translate-y-1"
                    />
                    Upload First Deck
                    <ArrowRight
                      size={18}
                      className="ml-2 transition-all opacity-0 group-hover/btn:opacity-100 group-hover/btn:translate-x-1"
                    />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
