import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../services/supabase";
import { Lock, Mail } from "lucide-react";
import penguinMascot from "../assets/penguine.png";
import logo from "../assets/Deckly.png";
import Button from "../components/common/Button";
import Input from "../components/common/Input";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-black p-4 md:p-6 gap-4 md:gap-6 overflow-hidden">
      {/* Left Panel - Hero - Hidden on Mobile */}
      <div className="hidden md:flex md:w-5/12 bg-deckly-primary p-12 flex-col items-center justify-center text-center rounded-3xl overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="relative mb-8"
        >
          <img
            src={penguinMascot}
            alt="Mascot"
            className="w-24 sm:w-40 md:w-42 h-auto object-contain"
          />
        </motion.div>
        <div className="max-w-[540px]">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-8">
            A pitchdeck management space build for founders and investors
          </h1>
          <p className="text-slate-800 text-lg md:text-xl font-medium leading-relaxed max-w-[400px] mx-auto">
            Free yourself from clutter of pitchdeck and focus on what matters
          </p>
        </div>
      </div>

      <div className="w-full md:w-7/12 bg-deckly-background p-8 md:p-12 lg:p-24 flex flex-col items-center justify-center overflow-y-auto rounded-3xl overflow-hidden">
        <div className="w-full max-w-[440px]">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-24 h-24 mb-8 flex items-center justify-center">
              <img
                src={logo}
                alt="Deckly"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
              Welcome Back
            </h2>
            <p className="text-slate-500 font-bold mb-8">
              An all in one pitchdeck management workspace
            </p>

            {/* Social Logins */}
            <div className="w-full space-y-4 mb-8">
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-300 font-bold text-sm hover:bg-white/10 transition-all"
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
                Continue with google
              </button>
              <button
                onClick={handleGitHubSignIn}
                className="w-full flex items-center justify-center gap-3 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-300 font-bold text-sm hover:bg-white/10 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  />
                </svg>
                Continue with github
              </button>
            </div>

            <div className="flex items-center w-full gap-4 mb-8">
              <div className="h-px bg-white/5 flex-1" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-600">
                Or Sign in With
              </span>
              <div className="h-px bg-white/5 flex-1" />
            </div>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <Input
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              icon={Mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="password"
              icon={Lock}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-deckly-accent/10 border border-deckly-accent/20 text-deckly-accent text-xs font-bold p-3 rounded-xl text-center"
              >
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              fullWidth
              size="large"
              loading={loading}
              className="font-bold tracking-widest uppercase py-4"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500 font-bold">
              New to Deckly?{" "}
              <Link
                to="/signup"
                className="text-deckly-primary hover:text-deckly-primary/80 transition-colors"
              >
                Create your space
              </Link>
            </p>
          </div>

          <p className="mt-12 text-[10px] text-slate-600 font-bold text-center leading-relaxed">
            © 2026 Deckly by Manish
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
