import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../services/supabase";
import { Lock, Mail, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { Turnstile } from "@marsidev/react-turnstile";
import leftPanelBg from "../assets/Signup Left.png";
import logo from "../assets/Deckly.png";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Log In | Deckly";
    posthog.capture("user_login_viewed");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    posthog.capture("user_login_submitted", { method: "email" });

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: captchaToken || undefined,
        },
      });

      if (error) throw error;
      posthog.capture("user_login_completed", { method: "email" });
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    posthog.capture("user_login_submitted", { method: "google" });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleGitHubSignIn = async () => {
    posthog.capture("user_login_submitted", { method: "github" });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-deckly-background">
      {/* Left Panel - Hero - Hidden on Mobile */}
      <div className="hidden md:flex md:w-1/2 relative flex-col p-12 lg:p-20 overflow-hidden min-h-screen border-r border-[#22C55E]/20">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-80"
          style={{ backgroundImage: `url(${leftPanelBg})` }}
        />
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/60" />

        {/* Spacer to push content to middle */}
        <div className="flex-1" />

        {/* Center Content - Logo, Headline, Paragraph */}
        <div className="relative z-10 flex flex-col justify-center">
          {/* DECKLY Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-10"
          >
            <img src={logo} alt="Deckly" className="w-10 h-10 object-contain" />
            <span className="text-[#22C55E] text-2xl font-bold tracking-widest">
              DECKLY
            </span>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h1 className="text-4xl lg:text-6xl font-bold text-white leading-[1.1] mb-6 tracking-tight">
              Pitchdeck
              <br />
              Management
              <br />
              Workspace
              <br />
              <span className="text-[#22C55E]">That Works.</span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-[420px]">
              Manage your entire deal flow in one secure workspace.
            </p>
          </motion.div>
        </div>

        {/* Spacer to push badges to bottom */}
        <div className="flex-1" />

        {/* Bottom Content - Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative z-10 flex gap-4 mt-auto"
        >
          <div className="bg-white/5 backdrop-blur-sm border-l-2 border-[#22C55E] px-4 py-3 min-w-[140px]">
            <p className="text-[#22C55E] text-xs font-semibold uppercase tracking-wider mb-1">
              BUILT FOR
            </p>
            <p className="text-white text-lg font-bold">Founders</p>
          </div>{" "}
          <div className="bg-white/5 backdrop-blur-sm border-l-2 border-[#22C55E] px-4 py-3 min-w-[140px]">
            <p className="text-[#22C55E] text-xs font-semibold uppercase tracking-wider mb-1">
              DETAILED
            </p>
            <p className="text-white text-lg font-bold">AI Powered</p>
          </div>
        </motion.div>
      </div>

      {/* Right Panel - Sign In Form */}
      <div className="w-full md:w-1/2 bg-deckly-background flex flex-col items-center justify-center relative z-10 min-h-screen p-8 md:p-12 lg:p-24 overflow-y-auto">
        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
              Sign In
            </h2>
            <p className="text-slate-500 text-sm">
              Welcome back to your workspace
            </p>
          </div>

          {/* Social Logins */}
          <div className="space-y-3 mb-6">
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 py-3 bg-white/5 border border-white/10 rounded-lg text-slate-300 font-medium text-sm hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.11c-.22-.67-.35-1.39-.35-2.11s.13-1.44.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51z"
                />
              </svg>
              Continue with Google
            </button>
            <button
              onClick={handleGitHubSignIn}
              className="w-full flex items-center justify-center gap-3 py-3 bg-white/5 border border-white/10 rounded-lg text-slate-300 font-medium text-sm hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                />
              </svg>
              Continue with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center w-full gap-4 mb-6">
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-xs uppercase font-medium tracking-wider text-slate-500">
              OR EMAIL
            </span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email Input */}
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                INSTITUTIONAL EMAIL
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <Mail size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="name@firm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-12 pl-12 pr-4 bg-surface-low border border-border text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#22C55E] transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  PASSWORD
                </label>

              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-12 pl-12 pr-12 bg-surface-low border border-border text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-[#22C55E] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-deckly-accent/20 border border-deckly-accent/40 text-deckly-accent text-sm font-bold p-4 rounded-lg text-center"
                id="login-error-message"
              >
                Sign-in failed: {error}
              </motion.div>
            )}

            {/* Turnstile Captcha */}
            <div className="flex justify-center mt-2">
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ""}
                onSuccess={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
                onError={() => setCaptchaToken(null)}
                options={{ theme: "dark" }}
              />
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading || (!captchaToken && !!import.meta.env.VITE_TURNSTILE_SITE_KEY)}
              className="w-full h-12 bg-[#22C55E] text-black font-semibold text-sm uppercase tracking-wider rounded-lg hover:bg-[#22C55E]/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  SIGN IN
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Signup Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-[#22C55E] font-semibold hover:text-[#22C55E]/80 transition-colors"
              >
                Signup
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-12 flex items-center justify-between">
            <p className="text-xs text-slate-600 font-medium">V0.0.5-ALPHA</p>
            <a
              href="https://deckly.space/privacy"
              className="text-xs text-slate-600 font-medium uppercase tracking-wider hover:text-slate-400 transition-colors"
            >
              PRIVACY POLICY
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
