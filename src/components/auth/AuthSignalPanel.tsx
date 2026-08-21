import { motion, useReducedMotion } from "framer-motion";

import logo from "../../assets/Deckly.png";

type AuthSignalPanelProps = {
  mode: "login" | "signup";
};

const routes = [
  { path: "M24 194 C92 194 112 124 184 124 S268 144 332 92", end: [332, 92], color: "#2AD485", glow: "#FF5C7A" },
  { path: "M24 210 C90 210 118 150 188 150 S270 166 332 132", end: [332, 132], color: "#58DE9E", glow: "#4FA3FF" },
  { path: "M24 226 C94 226 126 178 194 178 S274 188 332 170", end: [332, 170], color: "#16B96E", glow: "#FFD166" },
  { path: "M24 242 C98 242 136 208 198 208 S280 214 332 208", end: [332, 208], color: "#7DE6B2", glow: "#B778FF" },
  { path: "M24 258 C94 258 132 236 202 236 S282 236 332 244", end: [332, 244], color: "#10834F", glow: "#FF8A3D" },
] as const;

export function AuthSignalPanel({ mode }: AuthSignalPanelProps) {
  const reducedMotion = useReducedMotion();
  const signup = mode === "signup";

  return (
    <section
      aria-label="Deckly signal overview"
      className="relative hidden min-h-screen overflow-hidden bg-[#071E17] text-white md:flex md:w-1/2"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[#2AD485]/30" />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative z-10 flex w-full flex-col p-10 lg:p-16"
      >
        <div className="flex items-center gap-3">
          <img src={logo} alt="Deckly" className="h-9 w-9 object-contain" />
          <span className="font-headline text-[28px] font-semibold tracking-[-0.04em] text-white">
            Deckly
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center pb-12 pt-16 lg:pt-24">
          <motion.p
            initial={reducedMotion ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#2AD485]"
          >
            Secure sharing
          </motion.p>
          <motion.h1
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.14 }}
            className="max-w-[480px] font-headline text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-white lg:text-6xl"
          >
            {signup ? (
              <>
                One workspace.
                <br />
                <span className="text-[#2AD485]">Two perspectives.</span>
              </>
            ) : (
              <>
                Share your pitch.
                <br />
                <span className="text-[#2AD485]">Know who cares.</span>
              </>
            )}
          </motion.h1>
          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.26 }}
            className="mt-6 max-w-[360px] text-base leading-7 text-[#B6F0D2]/75"
          >
            A secure document sharing platform built for pitch decks, data rooms, and investor updates.
          </motion.p>

          <div className="relative mt-14 h-[300px] w-full max-w-[440px] lg:mt-20">
            <motion.svg
              viewBox="0 0 360 280"
              role="img"
              aria-label="Animated signal routes connecting a document to outcomes"
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              {routes.map((route, index) => (
                <g key={route.path}>
                  <motion.path
                    d={route.path}
                    fill="none"
                    stroke={route.color}
                    strokeLinecap="round"
                    strokeWidth="1.2"
                    initial={reducedMotion ? false : { pathLength: 0, opacity: 0.25 }}
                    animate={{ pathLength: 1, opacity: 0.95 }}
                    transition={{
                      duration: 0.72,
                      delay: 0.18 + index * 0.08,
                      ease: "easeOut",
                    }}
                  />
                  <motion.path
                    d={route.path}
                    fill="none"
                    stroke={route.color}
                    strokeLinecap="round"
                    strokeWidth="1.8"
                    strokeDasharray="1 18"
                    initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
                    animate={
                      reducedMotion
                        ? { pathLength: 1, opacity: 0 }
                        : { pathLength: 1, opacity: [0, 0.7, 0.7] , strokeDashoffset: [0, -38] }
                    }
                    transition={
                      reducedMotion
                        ? undefined
                        : {
                            pathLength: { duration: 0.72, delay: 0.18 + index * 0.08 },
                            opacity: { duration: 0.72, delay: 0.18 + index * 0.08 },
                            strokeDashoffset: {
                              duration: 2.2 + index * 0.18,
                              delay: 0.88 + index * 0.12,
                              repeat: Infinity,
                              ease: "linear",
                            },
                          }
                    }
                  />
                  {!reducedMotion && (
                    <>
                      <circle r="7" fill={route.glow} opacity="0.14">
                        <animateMotion
                          dur={`${3.1 + index * 0.24}s`}
                          begin={`${index * 0.26}s`}
                          repeatCount="indefinite"
                          path={route.path}
                        />
                      </circle>
                      <circle r="2.6" fill={route.glow}>
                        <animateMotion
                          dur={`${3.1 + index * 0.24}s`}
                          begin={`${index * 0.26}s`}
                          repeatCount="indefinite"
                          path={route.path}
                        />
                        <animate
                          attributeName="opacity"
                          values="0.35;1;0.35"
                          dur="1.1s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </>
                  )}
                  <motion.circle
                    cx={route.end[0]}
                    cy={route.end[1]}
                    r="4.5"
                    fill={route.glow}
                    initial={reducedMotion ? false : { scale: 0, opacity: 0 }}
                    animate={
                      reducedMotion
                        ? { scale: 1, opacity: 1 }
                        : { scale: [0, 1, 1.12, 1], opacity: [0, 1, 0.78, 1] }
                    }
                    transition={
                      reducedMotion
                        ? undefined
                        : {
                            duration: 1.15,
                            delay: 0.62 + index * 0.08,
                            repeat: Infinity,
                            repeatDelay: 2.4,
                            ease: "easeInOut",
                          }
                    }
                    style={{ transformOrigin: `${route.end[0]}px ${route.end[1]}px` }}
                  />
                </g>
              ))}
            </motion.svg>

            <motion.div
              animate={reducedMotion ? undefined : { y: [0, -3, 0] }}
              transition={reducedMotion ? undefined : { duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-5 left-3 h-28 w-20 rounded-[10px] border border-[#B6F0D2]/55 bg-[#F7FAF8] p-3 shadow-[0_20px_45px_rgba(0,0,0,0.2)]"
            >
              <div className="h-1.5 w-10 rounded-full bg-[#B6F0D2]" />
              <div className="mt-3 h-1.5 w-12 rounded-full bg-[#D8E8E0]" />
              <div className="mt-2 h-1.5 w-8 rounded-full bg-[#D8E8E0]" />
            </motion.div>

            <motion.div
              animate={reducedMotion ? undefined : { y: [0, 3, 0] }}
              transition={reducedMotion ? undefined : { duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-0 left-[60%] h-52 w-[44%] rounded-[14px] border border-[#58DE9E]/30 bg-[#58DE9E]/10"
            />
            <motion.div
              animate={reducedMotion ? undefined : { y: [0, -4, 0] }}
              transition={reducedMotion ? undefined : { duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute bottom-3 left-[65%] h-56 w-[44%] rounded-[14px] border border-[#7DE6B2]/35 bg-[#7DE6B2]/10"
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
