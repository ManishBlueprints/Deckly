import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";
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
    title: "Simple data rooms",
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
    title: "Open-source Core",
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

  useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <div className="bg-background text-on-surface selection:bg-primary selection:text-on-primary min-h-screen font-['Manrope'] overflow-hidden">
      {/* TopNavBar */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[1280px] z-50 rounded-2xl bg-[#131313]/80 backdrop-blur-md tracking-tight border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex justify-between items-center px-4 md:px-10 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <img
              src={decklyLogo}
              alt="Deckly Logo"
              className="h-6 w-auto"
              width="24"
              height="24"
              decoding="async"
            />
          </div>
          <span className="text-lg font-bold tracking-tighter text-[#54e98a] uppercase">
            Deckly
          </span>
        </div>

        <div className="flex items-center gap-3 md:gap-8">
          <button
            onClick={() => navigate("/login")}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white transition-colors px-2"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="bg-primary text-[#003919] px-6 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:scale-95 hover:shadow-[0_0_20px_rgba(84,233,138,0.3)] transition-all duration-150"
          >
            Get Started
          </button>
        </div>
      </nav>

      <main className="pt-40">
        {/* Hero Section */}
        <section className="px-10 max-w-[1440px] mx-auto mb-32 pt-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div
              className="lg:w-1/2"
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              <motion.h1
                variants={fadeInUp}
                className="text-[3.5rem] leading-[1.1] font-extrabold tracking-tighter mb-6"
              >
                Share your pitch deck. <br />
                <span className="text-primary">Know who actually cares.</span>
              </motion.h1>
              <motion.p
                variants={fadeInUp}
                className="text-lg text-on-surface-variant mb-10 max-w-xl"
              >
                Deckly helps founders track real investor interest and helps
                investors manage deal flow — without inbox chaos.
              </motion.p>
              <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
                <button
                  onClick={() => navigate("/signup")}
                  className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold text-base hover:scale-[0.98] transition-all shadow-[0_0_30px_rgba(84,233,138,0.2)]"
                >
                  Get Started Free
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="border border-outline-variant text-on-surface px-8 py-4 rounded-xl font-bold text-base hover:bg-surface-bright transition-all"
                >
                  See How It Works
                </button>
              </motion.div>
            </motion.div>

            <motion.div
              className="lg:w-1/2 relative group"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              <div className="absolute -inset-4 bg-[radial-gradient(ellipse_at_center,_rgba(84,233,138,0.15)_0%,_transparent_70%)] opacity-50"></div>
              <div className="relative bg-surface-container rounded-xl overflow-hidden shadow-2xl">
                <img
                  alt="Dashboard Preview"
                  className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  src={screen}
                  loading="lazy"
                  decoding="async"
                  width="2211"
                  height="1299"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent"></div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Positioning Section -> Industrial Mesh Grid */}
        <section className="px-10 max-w-[1440px] mx-auto mb-40">
          <motion.div
            className="mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeInUp}
          >
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-white max-w-2xl">
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
                className="p-10 border-r border-b border-white/10 group hover:bg-white/[0.01] transition-colors duration-300"
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

        {/* Split Perspective Section */}
        <section className="bg-surface-container-lowest py-32 px-10">
          <div className="max-w-[1440px] mx-auto">
            <motion.div
              className="text-center mb-20"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInUp}
            >
              <h2 className="text-4xl font-extrabold tracking-tighter">
                One workspace. Two perspectives.
              </h2>
            </motion.div>
            <motion.div
              className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-outline-variant/10 rounded-3xl overflow-hidden"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
            >
              {/* For Founders */}
              <motion.div
                variants={fadeInUp}
                className="p-12 md:p-20 bg-surface-container-low flex flex-col justify-center border-r border-outline-variant/10"
              >
                <div className="mb-8 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <span className="material-symbols-outlined">
                      rocket_launch
                    </span>
                  </div>
                  <h3 className="text-3xl font-bold">For Founders</h3>
                </div>
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-primary mt-1">
                      check_circle
                    </span>
                    <div>
                      <p className="font-bold">Share with a single link</p>
                      <p className="text-on-surface-variant text-sm">
                        Eliminate heavy PDF attachments that get blocked by
                        filters.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-primary mt-1">
                      check_circle
                    </span>
                    <div>
                      <p className="font-bold">Track engagement real-time</p>
                      <p className="text-on-surface-variant text-sm">
                        Know exactly when an Associate or GP opens your deck.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-primary mt-1">
                      check_circle
                    </span>
                    <div>
                      <p className="font-bold">Seamless version control</p>
                      <p className="text-on-surface-variant text-sm">
                        Update slides without breaking links already in investor
                        hands.
                      </p>
                    </div>
                  </li>
                </ul>
              </motion.div>

              {/* For Investors */}
              <motion.div
                variants={fadeInUp}
                className="p-12 md:p-20 bg-surface-container-low flex flex-col justify-center"
              >
                <div className="mb-8 flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <span className="material-symbols-outlined">
                      account_balance
                    </span>
                  </div>
                  <h3 className="text-3xl font-bold">For Investors</h3>
                </div>
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-primary mt-1">
                      check_circle
                    </span>
                    <div>
                      <p className="font-bold">Save and organize decks</p>
                      <p className="text-on-surface-variant text-sm">
                        A unified library for all incoming deal flow.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-primary mt-1">
                      check_circle
                    </span>
                    <div>
                      <p className="font-bold">AI-Powered Summaries</p>
                      <p className="text-on-surface-variant text-sm">
                        Instant synthesis of deck highlights and metrics.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <span className="material-symbols-outlined text-primary mt-1">
                      check_circle
                    </span>
                    <div>
                      <p className="font-bold">Smart Tagging</p>
                      <p className="text-on-surface-variant text-sm">
                        Never lose context on a startup with custom
                        venture-focused tags.
                      </p>
                    </div>
                  </li>
                </ul>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features Section -> Dynamic Depth Transition Stack */}
        <section
          ref={containerRef}
          className="relative py-40 px-6 md:px-10 max-w-[1440px] mx-auto min-h-[500vh]"
        >
          <div className="flex flex-col lg:flex-row gap-20 items-start">
            {/* Left Content: Sticky Title & Progress */}
            <div className="lg:w-[40%] lg:sticky lg:top-40 h-fit mb-20 lg:mb-0">
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

                <h2 className="text-6xl md:text-7xl font-bold tracking-tight mb-8 text-white leading-tight">
                  Everything you need <br />
                  <span className="text-on-surface-variant/40">
                    for your fundraise.
                  </span>
                </h2>

                <div className="space-y-8 max-w-sm">
                  <p className="text-xl text-on-surface-variant leading-relaxed font-medium">
                    A heavy-duty platform for deal management. Stored, tracked,
                    and closed in one place.
                  </p>

                  {/* Visual Progress Steps */}
                  <div className="space-y-4 pt-4 border-l border-white/5 pl-6">
                    {features.map((f, i) => {
                      // We'll use a simple indicator that fills based on the main scroll progress
                      // For simplicity, we just show them all and highlight active one via viewport logic
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-4 group cursor-pointer transition-all"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-primary transition-colors" />
                          <span className="text-sm font-bold text-on-surface-variant/40 group-hover:text-white transition-colors uppercase tracking-tight">
                            {f.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-16 flex items-center gap-6 p-6 bg-surface-container/40 border border-white/5 rounded-2xl w-fit">
                  <div className="flex -space-x-4">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-12 h-12 rounded-full border-2 border-background bg-surface-container-high overflow-hidden shadow-lg"
                      >
                        <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-xl">
                            person
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm text-white font-bold mb-0.5">
                      500+ Active Builders
                    </p>
                    <p className="text-[0.7rem] text-on-surface-variant uppercase tracking-widest font-black opacity-60">
                      Joined this week
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Side: Animated Card Stack */}
            <div className="lg:w-[60%] w-full flex flex-col gap-20">
              {features.map((feature, i) => (
                <FeatureCard key={i} feature={feature} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="py-40 px-10 max-w-[1440px] mx-auto relative">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent hidden lg:block" />
          <motion.div
            className="text-center mb-24 relative z-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeInUp}
          >
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50">
              From first view to final decision
            </h2>
          </motion.div>
          <motion.div
            className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {workflowSteps.map((item, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                className="flex-1 relative group w-full"
                whileHover={{ y: -10 }}
              >
                <div className="p-10 rounded-3xl bg-surface-container/40 border border-white/5 backdrop-blur-md group-hover:bg-surface-container-high transition-all duration-500 overflow-hidden relative min-h-[300px] flex flex-col justify-end">
                  <div className="absolute top-0 right-0 p-8 text-[8rem] font-black text-white/[0.02] group-hover:text-primary/[0.05] transition-colors duration-500 pointer-events-none select-none -mt-12 -mr-8">
                    {item.step}
                  </div>

                  <div className="relative z-10">
                    <div className="text-sm font-black text-primary mb-6 tracking-widest uppercase flex items-center gap-2">
                      <span className="w-6 h-[2px] bg-primary rounded-full" />{" "}
                      STEP {item.step}
                    </div>
                    <h4 className="text-2xl font-bold mb-4 text-white group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-on-surface-variant leading-relaxed text-base">
                      {item.desc}
                    </p>
                  </div>

                  {/* Subtle glow effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Value / Features Bullet Section */}
        <section className="py-40 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-container-low/50 to-transparent pointer-events-none" />
          <div className="px-10 max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 relative z-10 items-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeInUp}
              className="max-w-xl"
            >
              <h2 className="text-5xl font-extrabold tracking-tighter mb-8 leading-[1.1] text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                Simple, transparent, and built to scale
              </h2>
              <p className="text-on-surface-variant text-xl leading-relaxed mb-10">
                Fundraising is hard enough. Your tools should be the easiest
                part of your day. We built Deckly to be invisible, fast, and
                remarkably powerful.
              </p>
              <div className="flex items-center gap-4 text-sm font-bold text-primary bg-primary/10 w-fit px-5 py-3 rounded-full border border-primary/20">
                <span
                  className="material-symbols-outlined text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                Trusted by top founders globally
              </div>
            </motion.div>

            <motion.div
              className="flex flex-col gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
            >
              {valueFeatures.map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  whileHover={{ scale: 1.02, x: 10 }}
                  className="flex items-center gap-6 p-6 md:p-8 bg-surface-container-lowest/80 backdrop-blur-md border border-white/5 rounded-2xl group cursor-pointer relative overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(84,233,138,0.1)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  <div className="w-16 h-16 rounded-full bg-surface border border-white/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:border-primary/50 transition-colors duration-300 relative z-10">
                    <span
                      className="material-symbols-outlined text-primary text-2xl group-hover:scale-110 transition-transform duration-300"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {item.icon}
                    </span>
                  </div>

                  <div className="relative z-10">
                    <h5 className="font-bold text-xl mb-1 text-white group-hover:text-primary transition-colors duration-300">
                      {item.title}
                    </h5>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 px-6 md:px-10 max-w-[1440px] mx-auto relative overflow-hidden">
          <motion.div
            className="relative w-full rounded-[3rem] overflow-hidden bg-surface-container-lowest/40 border border-white/10 p-12 md:p-24 text-center backdrop-blur-xl group"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={fadeInUp}
          >
            {/* Animated Gradient Backgrounds */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[600px] bg-[radial-gradient(ellipse_at_center,_rgba(84,233,138,0.2)_0%,_transparent_70%)] pointer-events-none group-hover:bg-[radial-gradient(ellipse_at_center,_rgba(84,233,138,0.3)_0%,_transparent_70%)] transition-colors duration-1000"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05)_0%,_transparent_60%)] pointer-events-none"></div>

            <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
              <span className="px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-8 inline-block shadow-[0_0_20px_rgba(84,233,138,0.2)] backdrop-blur-md">
                Ready for launch
              </span>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 leading-[1.05] text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                Start your next fundraise with clarity.
              </h2>
              <p className="text-xl md:text-2xl text-on-surface-variant mb-12 font-medium max-w-2xl leading-relaxed">
                Share smarter. Track better. Close faster. Don't let your
                perfect pitch get lost in their inbox.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-md mx-auto">
                <button
                  onClick={() => navigate("/signup")}
                  className="group w-full sm:w-auto bg-primary text-on-primary px-10 py-5 rounded-2xl font-bold text-lg hover:scale-105 hover:shadow-[0_0_40px_rgba(84,233,138,0.4)] transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden"
                >
                  <span className="relative z-10">Start Free</span>
                  <ArrowUpRight className="relative z-10 w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                </button>
              </div>
              <p className="mt-8 text-sm text-on-surface-variant/80 font-medium tracking-wide">
                No credit card required. Always free for investors.
              </p>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-10 relative overflow-hidden pt-24 pb-8 bg-gradient-to-b from-[#0e0e0e] via-[#0e0e0e] to-[#54e98a]/10">
        {/* Subtle Background Pattern & Glow */}
        <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_center,_#54e98a_1px,_transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,_rgba(84,233,138,0.08)_0%,_transparent_70%)] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          {/* Top CTA Section */}
          <div className="max-w-2xl mb-24">
            <div className="text-[#54e98a] text-[10px] uppercase font-bold tracking-widest mb-4 flex items-center gap-2">
              <span className="text-xl leading-none -mt-1">+</span> Contact Us
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white leading-tight">
              A secure workspace for,{" "}
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
                href="mailto:hello@deckly.space"
                className="group inline-flex items-center gap-2 text-white hover:text-[#54e98a] text-lg md:text-xl font-bold transition-all"
              >
                hello@deckly.space
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
                className="w-[12vw] h-[12vw] object-contain hidden sm:block"
                width="120"
                height="120"
                decoding="async"
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
function FeatureCard({ feature, index }: FeatureCardProps) {
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const opacity = useTransform(
    scrollYProgress,
    [0, 0.4, 0.6, 1],
    [0, 1, 1, 0.4],
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 0.4, 0.6, 1],
    [0.9, 1.05, 1, 0.92],
  );
  const filter = useTransform(
    scrollYProgress,
    [0.6, 1],
    ["blur(0px)", "blur(2px)"],
  );

  return (
    <motion.div
      ref={ref}
      style={{
        opacity,
        scale,
        filter,
        top: `${160 + index * 20}px`,
        zIndex: index,
      }}
      className="sticky w-full mb-32 last:mb-0"
    >
      <div className="p-10 md:p-14 bg-surface-container border border-white/5 rounded-2xl shadow-[0_50px_100px_rgba(0,0,0,0.8)] group relative overflow-hidden flex flex-col min-h-[540px] justify-center transition-all duration-500 hover:border-primary/20">
        {/* Floating Number Accent */}
        <div className="absolute top-10 right-10 text-[12rem] font-black text-white/[0.02] pointer-events-none select-none italic group-hover:text-primary/[0.03] transition-colors duration-700">
          0{index + 1}
        </div>

        <div className="relative z-10">
          <div className="w-24 h-24 rounded-2xl bg-background border border-white/5 flex items-center justify-center mb-12 shadow-inner group-hover:border-primary/30 transition-all duration-500">
            <span
              className="material-symbols-outlined text-primary text-5xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {feature.icon}
            </span>
          </div>

          <h3 className="text-4xl font-bold mb-8 text-white tracking-tight leading-tight transition-colors group-hover:text-primary">
            {feature.title}
          </h3>
          <p className="text-xl text-on-surface-variant leading-relaxed max-w-xl font-medium">
            {feature.desc}
          </p>

          <div className="mt-12 flex items-center gap-4 text-primary font-black text-lg cursor-pointer group-hover:gap-6 transition-all uppercase tracking-widest text-[0.75rem]">
            Read documentation{" "}
            <ArrowUpRight
              size={20}
              className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-all"
            />
          </div>
        </div>

        {/* Subtle Bottom Accent */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-700" />
      </div>
    </motion.div>
  );
}
