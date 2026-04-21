import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useRef, useState } from "react";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import screen from "../assets/screen.png";
import decklyLogo from "../assets/Deckly.png";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const features = [
  {
    icon: "sensors",
    title: "See who actually engages",
    desc: "Not just opens — see who revisits, where they spend time, and when to follow up.",
  },
  {
    icon: "sync",
    title: "Update your deck without resending",
    desc: "Make changes anytime and keep the same link. Fix mistakes or improve your story without chasing investors again.",
  },
  {
    icon: "folder_shared",
    title: "Advance data rooms",
    desc: "Share multiple decks and documents in one place. Keep everything organized without messy folders or emails.",
  },
  {
    icon: "psychology",
    title: "Understand decks instantly",
    desc: "Get quick AI summaries to grasp any pitch in seconds — perfect for fast decisions and busy investors.",
  },
  {
    icon: "architecture",
    title: "Stay organized without effort",
    desc: "Tag, group, and find decks easily. Keep track of startups, stages, and conversations in one clean workspace.",
  },
  {
    icon: "encrypted",
    title: "Control who can access your deck",
    desc: "Set expiration dates, disable downloads, and manage access with simple controls — no complexity.",
  },
];

interface Feature {
  icon: string;
  title: string;
  desc: string;
  glow?: string;
}

interface FeatureCardProps {
  feature: Feature;
  index: number;
  className?: string;
}

interface WorkflowStep {
  step: string;
  title: string;
  desc: string;
}

interface ValueFeature {
  icon: string;
  title: string;
  desc: string;
}

const positioningFeatures: Feature[] = [
  {
    icon: "link",
    title: "Share once, update anytime",
    desc: "Fix a typo or update your traction. The link stays the same. Your investors always see the latest version.",
  },
  {
    icon: "analytics",
    title: "Know real investor interest",
    desc: "See which slides investors linger on and how many times they've opened your deck. Data-driven follow-ups.",
  },
  {
    icon: "inventory_2",
    title: "Stay organized without spreadsheets",
    desc: "Automatic tracking of every interaction. No more manual data entry into your CRM while you're pitching.",
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    step: "01",
    title: "Share",
    desc: "Upload your deck and generate a secure link in seconds. Customize the view permissions to match your stage.",
  },
  {
    step: "02",
    title: "See what happens",
    desc: "Get notified the second someone starts reading. Watch the session live or review the engagement data later.",
  },
  {
    step: "03",
    title: "Follow up with confidence",
    desc: "Reach out to the investors who showed high intent. Know exactly where they stopped reading and address it head-on.",
  },
];

const valueFeatures: ValueFeature[] = [
  {
    icon: "sell",
    title: "No hidden pricing",
    desc: "One clear plan for founders. Always free for investors to view.",
  },
  {
    icon: "bolt",
    title: "Open-source Core (Coming Soon)",
    desc: "Transparent code for ultimate trust and data privacy.",
  },
  {
    icon: "groups",
    title: "Dual-Focus Design",
    desc: "Optimized workflows for both sides of the table.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-background text-on-surface selection:bg-primary selection:text-on-primary min-h-screen font-['Manrope'] overflow-hidden">
      {/* TopNavBar -> Floating Glassmorphic Header */}
      <nav className="fixed top-0 left-0 w-full z-50 pointer-events-none">
        <div className="pointer-events-auto border border-white/10 mx-4 md:mx-8 mt-4 md:mt-6 max-w-[1440px] lg:mx-auto bg-background/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex justify-between items-center px-5 md:px-12 py-4 md:py-5">
            <div className="flex items-center gap-2 md:gap-3">
              <img
                src={decklyLogo}
                alt="Deckly Logo"
                className="h-8 md:h-9 w-auto"
                decoding="async"
              />
              <span className="text-lg md:text-xl font-bold tracking-tighter text-white ">
                deckly
              </span>
            </div>

            {/* Desktop buttons */}
            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => navigate("/login")}
                className="px-6 py-2 font-bold text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="bg-primary text-on-primary px-8 py-3 font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all"
              >
                Get Started
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5"
              aria-label="Toggle menu"
            >
              <span
                className={`block w-5 h-[2px] bg-white transition-all duration-300 ${mobileMenuOpen ? "rotate-45 translate-y-[4px]" : ""}`}
              />
              <span
                className={`block w-5 h-[2px] bg-white transition-all duration-300 ${mobileMenuOpen ? "opacity-0" : ""}`}
              />
              <span
                className={`block w-5 h-[2px] bg-white transition-all duration-300 ${mobileMenuOpen ? "-rotate-45 -translate-y-[4px]" : ""}`}
              />
            </button>
          </div>

          {/* Mobile dropdown menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="flex flex-col gap-2 px-5 pb-5 border-t border-white/10 pt-4">
              <button
                onClick={() => {
                  navigate("/login");
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-4 py-3 font-bold text-xs uppercase tracking-widest text-on-surface-variant hover:text-primary hover:bg-white/[0.02] transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  navigate("/signup");
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-primary text-on-primary px-4 py-3 font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all text-center"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative pt-28 sm:pt-40 lg:pt-48 pb-20 md:pb-32">
        {/* Subtle Background Grid */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,_#fff_1px,_transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        {/* Technical Accents: Crosshairs */}
        <div className="absolute top-20 left-12 text-primary/30 pointer-events-none select-none">
          <span className="material-symbols-outlined text-sm">add</span>
        </div>
        <div className="absolute top-20 right-12 text-primary/30 pointer-events-none select-none">
          <span className="material-symbols-outlined text-sm">add</span>
        </div>

        {/* Hero Section -> Industrial Mesh */}
        <section className="px-5 md:px-10 max-w-[1440px] mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-10 md:gap-20">
            <motion.div
              className="lg:w-1/2"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.div variants={fadeInUp} className="mb-6">
                <span className="px-4 py-1.5 border border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em]">
                  ALPHA VERSION LIVE NOW
                </span>
              </motion.div>
              <motion.h1
                variants={fadeInUp}
                className="text-4xl sm:text-5xl md:text-7xl leading-[0.95] font-black tracking-tighter mb-8 text-white uppercase"
              >
                Share your pitch. <br />
                <span className="text-primary">Know who cares.</span>
              </motion.h1>
              <motion.p
                variants={fadeInUp}
                className="text-base md:text-lg lg:text-xl text-on-surface-variant mb-8 md:mb-10 max-w-xl font-medium leading-relaxed opacity-80"
              >
                Deckly helps founders track real investor interest and helps
                investors manage deal flow — without inbox chaos.
              </motion.p>
              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-3 md:gap-4"
              >
                <button
                  onClick={() => navigate("/signup")}
                  className="bg-primary text-on-primary px-6 md:px-8 py-3.5 md:py-4 font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  Get Started Free
                  <ArrowUpRight size={16} />
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="border border-white/10 text-white px-6 md:px-8 py-3.5 md:py-4 font-black text-xs uppercase tracking-widest hover:bg-white/[0.02] transition-all w-full sm:w-auto text-center"
                >
                  See How It Works
                </button>
              </motion.div>
            </motion.div>

            {/* Technical Screenshot Frame */}
            <motion.div
              className="lg:w-1/2 relative group"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <div className="relative border border-white/10 p-4 bg-[#0e0e0e]">
                {/* Frame Labels */}
                <div className="absolute -top-3 left-6 px-2 bg-[#0e0e0e] text-[8px] font-black text-primary/60 uppercase tracking-widest z-20">
                  [ SYSTEM // ACTIVE ]
                </div>
                <div className="absolute -bottom-3 right-6 px-2 bg-[#0e0e0e] text-[8px] font-black text-white/30 uppercase tracking-widest z-20">
                  VIEW // PITCH_DECK_V1.2
                </div>

                <div className="relative overflow-hidden border border-white/5">
                  <img
                    alt="Dashboard Preview"
                    className="w-full h-auto opacity-90 group-hover:opacity-100 transition-opacity duration-700"
                    src={screen}
                    loading="lazy"
                    decoding="async"
                    width="2211"
                    height="1299"
                  />
                  {/* Scanning Light Effect */}
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent h-1/4 -translate-y-full group-hover:translate-y-[400%] transition-transform duration-[3000ms] pointer-events-none" />
                </div>
              </div>

              {/* Background Accent Shadow */}
              <div className="absolute -inset-4 bg-primary/5 blur-[100px] -z-10 group-hover:bg-primary/10 transition-colors duration-1000" />
            </motion.div>
          </div>
        </section>

        <section className="px-5 md:px-10 max-w-[1440px] mx-auto mb-12 md:mb-20 mt-20 md:mt-32 relative overflow-hidden">
          {/* Subtle Industrial Dot Pattern */}
          <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#fff_1px,_transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          <motion.div
            className="mb-16 relative z-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeInUp}
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-white max-w-2xl uppercase">
              Built for how fundraising <br />
              <span className="text-primary">actually works.</span>
            </h2>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 border-t border-l border-white/10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {positioningFeatures.map((feature, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                className="p-6 md:p-10 border-r border-b border-white/10 group hover:bg-white/[0.01] transition-colors duration-300"
              >
                <div className="flex flex-col gap-6">
                  <span className="material-symbols-outlined text-primary text-3xl font-bold">
                    {feature.icon}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-4 tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-on-surface-variant leading-relaxed font-medium">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Split Perspective Section -> Industrial Mesh */}
        <section className="bg-background py-16 md:py-24 px-5 md:px-10 border-t border-white/5">
          <div className="max-w-[1440px] mx-auto">
            <motion.div
              className="text-center mb-12 md:mb-24"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInUp}
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter text-white">
                One workspace. <br />
                <span className="text-on-surface-variant/40">
                  Two perspectives.
                </span>
              </h2>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 border-t border-l border-white/10 shadow-2xl"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
            >
              {/* For Founders */}
              <motion.div
                variants={fadeInUp}
                className="p-6 md:p-12 lg:p-20 border-r border-b border-white/10 flex flex-col justify-center bg-surface-low/30 hover:bg-white/[0.01] transition-colors duration-500"
              >
                <div className="mb-8 md:mb-12 flex items-center gap-4 md:gap-6">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(84,233,138,0.1)]">
                    <span
                      className="material-symbols-outlined text-2xl md:text-3xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      rocket_launch
                    </span>
                  </div>
                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white uppercase">
                    For Founders
                  </h3>
                </div>
                <ul className="space-y-6 md:space-y-10">
                  {[
                    {
                      title: "Share with a single link",
                      desc: "Eliminate heavy PDF attachments that get blocked by filters.",
                    },
                    {
                      title: "Track engagement real-time",
                      desc: "Know exactly when an Associate or GP opens your deck.",
                    },
                    {
                      title: "Seamless version control",
                      desc: "Update slides without breaking links already in investor hands.",
                    },
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-4 md:gap-6 group"
                    >
                      <span
                        className="material-symbols-outlined text-primary text-2xl md:text-3xl font-bold"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <div>
                        <p className="text-lg md:text-xl font-bold text-white mb-1 md:mb-2 leading-none uppercase tracking-tight">
                          {item.title}
                        </p>
                        <p className="text-on-surface-variant text-base font-medium opacity-80">
                          {item.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* For Investors */}
              <motion.div
                variants={fadeInUp}
                className="p-6 md:p-12 lg:p-20 border-r border-b border-white/10 flex flex-col justify-center bg-surface-low/30 hover:bg-white/[0.01] transition-colors duration-500"
              >
                <div className="mb-8 md:mb-12 flex items-center gap-4 md:gap-6">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_30px_rgba(84,233,138,0.1)]">
                    <span
                      className="material-symbols-outlined text-2xl md:text-3xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      account_balance
                    </span>
                  </div>
                  <h3 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-white uppercase">
                    For Investors
                  </h3>
                </div>
                <ul className="space-y-6 md:space-y-10">
                  {[
                    {
                      title: "Save and organize decks",
                      desc: "A unified library for all incoming deal flow.",
                    },
                    {
                      title: "AI-Powered Summaries",
                      desc: "Instant synthesis of deck highlights and metrics.",
                    },
                    {
                      title: "Smart Tagging",
                      desc: "Never lose context on a startup with custom venture-focused tags.",
                    },
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-4 md:gap-6 group"
                    >
                      <span
                        className="material-symbols-outlined text-primary text-2xl md:text-3xl font-bold"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <div>
                        <p className="text-lg md:text-xl font-bold text-white mb-1 md:mb-2 leading-none uppercase tracking-tight">
                          {item.title}
                        </p>
                        <p className="text-on-surface-variant text-base font-medium opacity-80">
                          {item.desc}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section -> Dynamic Depth Transition Stack */}
        <section
          ref={containerRef}
          className="relative py-16 md:py-24 px-5 md:px-10 max-w-[1440px] mx-auto"
        >
          <div className="flex flex-col gap-16 md:gap-24">
            {/* Top Content: Title & Description */}
            <div className="w-full max-w-4xl">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-[2px] w-12 bg-primary" />
                  <span className="text-primary font-black uppercase tracking-widest text-xs">
                    Capabilities
                  </span>
                </div>

                <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 md:mb-8 text-white leading-tight">
                  Everything you need <br />
                  <span className="text-on-surface-variant/40">
                    for your fundraise.
                  </span>
                </h2>

                <p className="text-base md:text-xl text-on-surface-variant leading-relaxed font-medium">
                  A heavy-duty platform for deal management. Stored, tracked,
                  and closed in one place.
                </p>
              </motion.div>
            </div>

            {/* Grid Cards Below */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative h-fit">
              {features.map((feature, i) => (
                <FeatureCard
                  key={i}
                  feature={feature}
                  index={i}
                  className={
                    i === 0
                      ? "lg:col-span-2 lg:row-span-2 h-full"
                      : i === 5
                        ? "md:col-span-2 lg:col-span-1"
                        : ""
                  }
                />
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Section -> Industrial Mesh */}
        <section className="py-16 md:py-24 px-5 md:px-10 max-w-[1440px] mx-auto relative group overflow-hidden">
          {/* Subtle Vertical Dot Pattern - Visibility Increased */}
          <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#fff_1px,_transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          <motion.div
            className="text-center mb-12 md:mb-24 relative z-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeInUp}
          >
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-black tracking-tighter text-white uppercase leading-[0.95]">
              From first view <br />
              <span className="text-on-surface-variant/40">
                to final decision
              </span>
            </h2>
          </motion.div>
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 border-t border-l border-white/10 relative z-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {workflowSteps.map((item, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                className="p-6 md:p-8 lg:p-12 border-r border-b border-white/10 group hover:bg-white/[0.01] transition-colors duration-500 min-h-[280px] md:min-h-[360px] flex flex-col justify-between"
              >
                <div className="relative">
                  <div className="text-[5rem] font-black text-white/[0.02] absolute -top-10 -left-6 pointer-events-none select-none">
                    {item.step}
                  </div>
                  <div className="text-sm font-bold text-primary mb-10 tracking-widest uppercase flex items-center gap-3 relative z-10">
                    <span className="w-8 h-[2px] bg-primary" />
                    STEP {item.step}
                  </div>
                </div>

                <div className="relative z-10">
                  <h4 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-white tracking-tight">
                    {item.title}
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed text-base md:text-lg font-medium opacity-80">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Value / Features Bullet Section -> Industrial Mesh */}
        <section className="py-20 md:py-40 relative overflow-hidden border-t border-white/10">
          {/* Subtle Industrial Dot Pattern */}
          <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#fff_1px,_transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          <div className="px-5 md:px-10 max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-24 relative z-10 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInUp}
              className="max-w-xl"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter mb-6 md:mb-8 leading-[1.1] text-white">
                Simple, transparent, <br />
                <span className="text-on-surface-variant/40">
                  and built to scale.
                </span>
              </h2>
              <p className="text-on-surface-variant text-base md:text-xl leading-relaxed mb-8 md:mb-12 font-medium">
                Fundraising is hard enough. Your tools should be the easiest
                part of your day. We built Deckly to be invisible, fast, and
                remarkably powerful.
              </p>
              <div className="flex items-center gap-4 text-xs font-black text-primary bg-primary/5 w-fit px-8 py-4 border border-primary/20 uppercase tracking-[0.2em]">
                <span
                  className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                Trusted by top founders globally
              </div>
            </motion.div>

            <motion.div
              className="flex flex-col border-t border-l border-white/10"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
            >
              {valueFeatures.map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="flex items-center gap-4 md:gap-6 p-5 md:p-8 lg:p-10 border-r border-b border-white/10 group hover:bg-white/[0.01] transition-colors duration-300 relative overflow-hidden"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-background border border-white/10 flex items-center justify-center shrink-0 group-hover:border-primary/50 transition-colors duration-300 relative z-10">
                    <span
                      className="material-symbols-outlined text-primary text-xl md:text-2xl group-hover:scale-110 transition-transform duration-300"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {item.icon}
                    </span>
                  </div>

                  <div className="relative z-10">
                    <h5 className="font-bold text-lg md:text-xl mb-1 text-white group-hover:text-primary transition-colors duration-300">
                      {item.title}
                    </h5>
                    <p className="text-base text-on-surface-variant leading-relaxed font-medium opacity-80">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Final CTA -> Technical Blueprint Node */}
        <section className="py-16 md:py-24 px-5 md:px-10 max-w-[1440px] mx-auto relative">
          <motion.div
            className="relative w-full border border-white/10 p-8 md:p-12 lg:p-24 text-center bg-[#0e0e0e] group overflow-hidden"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeInUp}
          >
            {/* Architectural Corner Brackets */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary/30 z-20" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary/30 z-20" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary/30 z-20" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary/30 z-20" />

            {/* Technical Crosshairs */}
            <div className="absolute top-12 left-12 text-primary/20 text-[10px] font-black pointer-events-none select-none">
              +
            </div>
            <div className="absolute top-12 right-12 text-primary/20 text-[10px] font-black pointer-events-none select-none">
              +
            </div>
            <div className="absolute bottom-12 left-12 text-primary/20 text-[10px] font-black pointer-events-none select-none">
              +
            </div>
            <div className="absolute bottom-12 right-12 text-primary/20 text-[10px] font-black pointer-events-none select-none">
              +
            </div>

            {/* Vertical 'Lane' Lines */}
            <div className="absolute inset-y-0 left-16 md:left-32 w-[1px] bg-white/5 hidden sm:block" />
            <div className="absolute inset-y-0 right-16 md:right-32 w-[1px] bg-white/5 hidden sm:block" />

            {/* Large Logo Watermark */}
            <div className="absolute -bottom-24 -right-24 opacity-[0.03] -rotate-12 pointer-events-none select-none">
              <img
                src={decklyLogo}
                alt=""
                className="w-96 h-96 object-contain"
              />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
              <div className="inline-flex items-center gap-3 px-6 py-2 border border-primary/20 bg-primary/5 mb-12">
                <span className="w-1.5 h-1.5 bg-primary animate-pulse" />
                <span className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">
                  Ready for launch
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter mb-6 md:mb-8 leading-[0.95] text-white uppercase">
                Start your fundraise <br />
                <span className="text-on-surface-variant/40">
                  with total clarity.
                </span>
              </h2>
              <p className="text-base md:text-lg lg:text-xl text-on-surface-variant mb-8 md:mb-12 font-medium max-w-2xl leading-relaxed opacity-80">
                Share smarter. Track better. Close faster. Don't let your
                perfect pitch get lost in their inbox.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-md mx-auto">
                <button
                  onClick={() => navigate("/signup")}
                  className="group relative w-full sm:w-auto bg-primary text-on-primary px-10 py-5 font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-4 overflow-hidden"
                >
                  {/* Button Inner Detail */}
                  <div className="absolute inset-[1px] border border-white/20 pointer-events-none opacity-50" />
                  <span className="relative z-10 flex items-center gap-4">
                    Start Free
                    <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </span>
                </button>
              </div>
              <p className="mt-10 text-[8px] md:text-[10px] text-on-surface-variant/60 font-black uppercase tracking-[0.4em]">
                No credit card required. Always free for investors.
              </p>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer -> Synced with Terms Style */}
      <footer className="border-t border-white/5 mt-10 relative overflow-hidden pt-12 md:pt-24 pb-8 bg-gradient-to-b from-[#0e0e0e] via-[#0e0e0e] to-[#54e98a]/10">
        {/* Subtle Background Pattern & Glow */}
        <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_center,_#54e98a_1px,_transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#54e98a]/[0.08] blur-[120px] pointer-events-none rounded-t-[100%]" />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          {/* Top CTA Section */}
          <div className="max-w-2xl mb-12 md:mb-24">
            <div className="text-[#54e98a] text-[10px] uppercase font-bold tracking-widest mb-4 flex items-center gap-2">
              <span className="text-xl leading-none -mt-1">+</span> Contact Us
            </div>
            <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold tracking-tighter text-white leading-tight">
              A securing workspace for,{" "}
              <span className="text-slate-500">
                founders and investors workflows.
              </span>
            </h2>
          </div>

          {/* Middle Links Section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 mb-16">
            {/* Contact Info */}
            <div className="space-y-2">
              <p className="text-slate-500 text-xs font-medium">
                Contact Team at:
              </p>
              <a
                href="mailto:contact@deckly.space"
                className="group inline-flex items-center gap-2 text-white hover:text-[#54e98a] text-lg md:text-xl font-bold transition-all"
              >
                contact@deckly.space
                <ArrowUpRight
                  size={20}
                  className="text-slate-400 group-hover:text-[#54e98a] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                />
              </a>
            </div>

            {/* Horizontal Links */}
            <ul className="flex flex-wrap items-center gap-6 md:gap-10">
              <li>
                <Link
                  to="/privacy"
                  className="text-white hover:text-[#54e98a] text-sm md:text-base font-bold transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-white hover:text-[#54e98a] text-sm md:text-base font-bold transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Massive Brand Name */}
          <div className="mb-8 w-full border-b border-white/5 pb-8 flex justify-center items-center">
            <div className="flex items-center justify-center gap-4 w-full">
              {/* Deckly Logo Mark as the D */}
              <img
                src={decklyLogo}
                alt="Deckly"
                className="w-[18vw] sm:w-[12vw] h-[18vw] sm:h-[12vw] object-contain"
              />
              <h1 className="text-[14vw] sm:text-[12vw] leading-none font-bold tracking-tighter text-white select-none lowercase">
                deckly
              </h1>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
            <p className="text-[10px] text-white font-medium tracking-wide">
              © 2026 Deckly. All rights reserved.
            </p>
            <div className="flex gap-6 text-[10px] text-white font-medium tracking-wide">
              <a href="#" className="hover:text-[#54e98a] transition-colors">
                LinkedIn
              </a>
              <a href="#" className="hover:text-[#54e98a] transition-colors">
                Twitter
              </a>
              <a href="#" className="hover:text-[#54e98a] transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Child component for managed scroll depth animations
// Child component for Bento Grid Features
function FeatureCard({ feature, index, className = "" }: FeatureCardProps) {
  return (
    <div
      className={`p-6 md:p-8 bg-surface-container border border-white/10 rounded-none shadow-[0_10px_30px_rgba(0,0,0,0.4)] group relative overflow-hidden flex flex-col transition-all duration-500 hover:border-primary/40 ${className} ${index === 0 ? "min-h-[400px]" : "min-h-[250px]"}`}
    >
      {/* Decorative Corner Outlines */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/20 group-hover:border-primary/60 transition-colors duration-500" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-white/20 group-hover:border-primary/60 transition-colors duration-500" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-white/20 group-hover:border-primary/60 transition-colors duration-500" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/20 group-hover:border-primary/60 transition-colors duration-500" />
      {/* Visual Decoration Wrapper */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.4] group-hover:opacity-[0.7] transition-opacity duration-700 overflow-hidden">
        <VisualDecoration index={index} />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-end mb-4">
          <div className="text-[10px] font-black text-white/10 uppercase tracking-[0.2em]">
            Deckly // 0{index + 1}
          </div>
        </div>

        <div className="mt-auto">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 shrink-0 rounded-none bg-background border border-white/5 flex items-center justify-center shadow-inner group-hover:border-primary/30 transition-all duration-500">
              <span
                className="material-symbols-outlined text-primary text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {feature.icon}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tighter leading-tight transition-colors group-hover:text-primary">
              {feature.title}
            </h3>
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed max-w-xl font-medium">
            {feature.desc}
          </p>
        </div>
      </div>

      {/* Subtle Hover Glow */}
      <div className="absolute -inset-4 bg-primary/2 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10" />
    </div>
  );
}

function VisualDecoration({ index }: { index: number }) {
  switch (index) {
    case 0: // Engagement (Large)
      return (
        <div className="absolute inset-0 flex items-center justify-center translate-y-12 translate-x-8 opacity-20 group-hover:opacity-40 transition-all duration-1000">
          <div className="w-full h-full p-8 flex flex-col">
            {/* Coordinate System Grid */}
            <div className="absolute inset-0 p-8">
              <div className="w-full h-full border-l border-b border-white/10 flex flex-col justify-between">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-full border-t border-white/5 h-0" />
                ))}
              </div>
            </div>

            {/* Bar Chart */}
            <div className="relative flex-1 mt-12 flex items-end gap-3 h-48">
              {[60, 45, 90, 75, 40, 65, 85, 55, 70].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col justify-end h-full"
                >
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    transition={{ duration: 1, delay: i * 0.05 + 0.5 }}
                    className="w-full bg-gradient-to-t from-primary/40 to-primary border-t border-x border-white/10 relative group/bar"
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-bold text-primary opacity-0 group-hover/bar:opacity-100 transition-opacity">
                      {h}%
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>

            {/* Live Activity Pills */}
            <div className="mt-8 flex flex-col gap-2">
              {[
                {
                  name: "Investor X",
                  time: "just now",
                  status: "viewed slide 4",
                },
                { name: "Fund Sequoia", time: "2m ago", status: "revisited" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ x: 20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.2 + 1 }}
                  className="flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-2 rounded-full w-fit"
                >
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] text-white/60 font-bold uppercase tracking-wider">
                    {item.name} {item.status}
                  </span>
                  <span className="text-[9px] text-primary/40">
                    {item.time}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      );
    case 1: // Update / Live Sync
      return (
        <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:scale-110 transition-transform duration-1000">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 border border-white/10 rounded-full animate-spin-slow" />
            <span className="material-symbols-outlined text-[4rem] text-white">
              sync
            </span>
          </div>
        </div>
      );
    case 2: // Data Rooms
      return (
        <div className="absolute bottom-0 right-0 p-4 opacity-10 flex flex-wrap gap-2 justify-end w-40">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="w-12 h-16 border border-white/20 bg-white/5 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-xs">
                description
              </span>
            </div>
          ))}
        </div>
      );
    case 3: // AI Summary
      return (
        <div className="absolute inset-0 p-8 flex flex-col gap-2 opacity-[0.05]">
          <div className="w-full h-2 bg-white rounded-full" />
          <div className="w-full h-2 bg-white rounded-full" />
          <div className="w-3/4 h-2 bg-white rounded-full" />
          <div className="w-full h-2 bg-primary rounded-full mt-4" />
          <div className="w-1/2 h-2 bg-primary rounded-full" />
        </div>
      );
    case 4: // Organization
      return (
        <div className="absolute top-0 right-0 p-4 flex gap-2 opacity-10 -rotate-12 translate-x-4">
          {["SaaS", "Fintech", "Series A"].map((tag, i) => (
            <div
              key={i}
              className="px-3 py-1 border border-white/40 text-[10px] font-bold text-white uppercase"
            >
              {tag}
            </div>
          ))}
        </div>
      );
    case 5: // Control
      return (
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <div className="w-24 h-10 border border-white/20 rounded-full flex items-center px-2">
            <div className="w-6 h-6 bg-primary rounded-full translate-x-14" />
          </div>
        </div>
      );
    default:
      return null;
  }
}
