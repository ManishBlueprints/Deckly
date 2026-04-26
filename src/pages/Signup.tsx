import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../services/supabase";
import { Lock, Mail, CheckCircle2, User } from "lucide-react";
import posthog from "posthog-js";
import { toast } from "sonner";
import leftPanelBg from "../assets/Signup Left.png";
import logo from "../assets/Deckly.png";
import { Button } from "../components/ui/button";
import { FormInput } from "../components/ui/form-input";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { getFriendlyAuthErrorMessage } from "../utils/authErrorMessages";

function Signup() {
  const captchaSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const captchaRequired = import.meta.env.PROD;
  const captchaConfigError =
    captchaRequired && !captchaSiteKey
      ? "CAPTCHA is required for email signup, but the Turnstile site key is missing."
      : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Sign Up | Deckly";
    posthog.capture("user_signup_viewed");
  }, []);

  const formatErrorMessage = (msg: string) => {
    if (
      msg
        .toLocaleLowerCase()
        .includes("password should contain at least one character of each")
    ) {
      return "Password must be at least 8 characters long and include an uppercase letter, a number, and a special character.";
    }
    return msg;
  };

  const isNetworkErrorMessage = (msg: string) => {
    const normalized = msg.toLowerCase();
    return (
      normalized.includes("failed to fetch") ||
      normalized.includes("network") ||
      normalized.includes("fetch") ||
      normalized.includes("load failed")
    );
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaConfigError) {
      setError(captchaConfigError);
      toast.error(captchaConfigError);
      return;
    }
    if (captchaRequired && !captchaToken) {
      const message = "Please complete the CAPTCHA to continue.";
      setError(message);
      toast.error(message);
      return;
    }
    setLoading(true);
    setError(null);
    posthog.capture("user_signup_submitted", { method: "email" });

    let shouldResetTurnstile = true;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + "/login",
          data: {
            full_name: fullName,
          },
          captchaToken: captchaToken || undefined,
        },
      });

      if (error) throw error;

      if (data.user) {
        setSuccess(true);
        posthog.capture("user_signup_completed", { method: "email" });
        setTimeout(() => navigate("/login"), 4000);
      }
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const friendlyMessage = getFriendlyAuthErrorMessage(err);
      if (isNetworkErrorMessage(rawMessage)) {
        shouldResetTurnstile = false;
      }
      const finalMessage = formatErrorMessage(friendlyMessage);
      setError(finalMessage);
      toast.error(finalMessage);
      posthog.capture("user_signup_failed", { method: "email", error: rawMessage });
    } finally {
      setLoading(false);
      if (shouldResetTurnstile) {
        setCaptchaToken(null);
        turnstileRef.current?.reset();
      }
    }
  };

  const handleGoogleSignIn = async () => {
    posthog.capture("user_signup_submitted", { method: "google" });
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
    posthog.capture("user_signup_submitted", { method: "github" });
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
          </div>
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
              Sign Up
            </h2>
            <p className="text-slate-500 text-sm">
              Create your workspace account
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

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-6"
              >
                <div className="w-16 h-16 bg-deckly-primary/20 text-deckly-primary rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">
                  Check your email
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  We've sent a confirmation link to <strong>{email}</strong>.
                  Redirecting to login shortly...
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSignup}
                className="flex flex-col gap-3"
              >
                <FormInput
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  icon={User}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />

                <FormInput
                  label="Email Address"
                  type="email"
                  placeholder="name@company.com"
                  icon={Mail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <FormInput
                  label="Password"
                  type="password"
                  placeholder="password"
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />

                {error && (
                  <div className="bg-deckly-accent/10 border border-deckly-accent/20 text-deckly-accent text-xs font-bold p-3 rounded-xl text-center">
                    {error}
                  </div>
                )}

                {captchaSiteKey && (
                  <div className="mt-4 flex justify-center">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={captchaSiteKey}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                      options={{ theme: "dark" }}
                    />
                  </div>
                )}

                {captchaConfigError && (
                  <div className="bg-deckly-accent/10 border border-deckly-accent/20 text-deckly-accent text-xs font-bold p-3 rounded-xl text-center">
                    {captchaConfigError}
                  </div>
                )}

                <div className="mt-4">
                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    loading={loading}
                    disabled={loading || (captchaRequired && (!captchaSiteKey || !captchaToken))}
                    className="w-full h-12 bg-[#22C55E] text-black font-semibold text-sm uppercase tracking-wider rounded-lg hover:bg-[#22C55E]/90 transition-colors flex items-center justify-center"
                  >
                    SIGN UP
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-4 text-center">
            <p className="text-sm text-slate-500 font-bold">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-deckly-primary hover:text-deckly-primary/80 transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>

          <p className="mt-6 text-[10px] text-slate-600 font-bold text-center leading-relaxed italic opacity-80">
            By signing up you agree to our{" "}
            <a
              href="https://deckly.space/terms"
              className="underline cursor-pointer hover:text-slate-400 transition-colors"
            >
              terms and conditions
            </a>{" "}
            and our{" "}
            <a
              href="https://deckly.space/privacy"
              target="_blank"
              rel="noreferrer noopener"
              className="underline cursor-pointer hover:text-slate-400 transition-colors"
            >
              privacy policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
