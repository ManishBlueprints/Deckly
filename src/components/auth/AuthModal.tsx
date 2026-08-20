import { Link } from "react-router-dom";
import { Github } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../services/supabase";
import logo from "../../assets/Deckly.png";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
  redirectTo?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  message = "Sign up to never lose track of your decks. Save this deck to your private library or add notes.",
  redirectTo,
}: AuthModalProps) {
  const handleOAuthSignIn = async (provider: "google" | "github", friendlyName: string) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo || window.location.href,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`${friendlyName} login failed:`, errorMessage);
      toast.error(`${friendlyName} authentication failed. Please try again.`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader className="items-center text-center">
          <div className="w-16 h-16 bg-deckly-primary/10 rounded-2xl flex items-center justify-center text-deckly-primary border border-deckly-primary/20 mx-auto mb-6">
            <img src={logo} alt="Deckly" className="w-10 h-10 object-contain" />
          </div>
          <DialogTitle className="text-2xl">Join Deckly</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogBody className="text-center">
          <div className="space-y-4">
            <button
              onClick={() => handleOAuthSignIn("google", "Google")}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-ui-border bg-ui-surface text-sm font-semibold text-ui-text hover:bg-ui-subtle"
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
              <span>Continue with Google</span>
            </button>

            <button
              onClick={() => handleOAuthSignIn("github", "GitHub")}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-ui-border bg-ui-surface text-sm font-semibold text-ui-text hover:bg-ui-subtle"
            >
              <Github size={20} />
              <span>Continue with GitHub</span>
            </button>
          </div>

          <div className="mt-8 border-t border-ui-border pt-6 text-center">
            <p className="text-xs text-ui-muted">
              By joining, you agree to our{" "}
              <Link to="/privacy" className="text-ui-primary hover:underline">Privacy Policy</Link>
              {" "}and{" "}
              <Link to="/terms" className="text-ui-primary hover:underline">Terms of Service</Link>
            </p>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
