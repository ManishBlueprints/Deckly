import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../services/supabase";
import { userService } from "../services/userService";
import { UserProfile, BrandingSettings } from "../types";

interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isPro: boolean;
  refreshProfile: () => Promise<void>;
  branding: BrandingSettings | null;
  setBranding: React.Dispatch<React.SetStateAction<BrandingSettings | null>>;
  refreshBranding: () => Promise<void>;
  signOut: () => Promise<void>;
  initializationError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem("deckly-user-profile");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<BrandingSettings | null>(() => {
    try {
      const cached = localStorage.getItem("deckly-branding-settings");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const loadingRef = React.useRef(true);

  // Sync ref with state
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const fetchProfile = async (userId: string) => {
    try {
      let data = await userService.getProfile(userId);

      // Auto-create profile if it doesn't exist (e.g. Google OAuth first sign-in)
      if (!data) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const meta = user?.user_metadata;
        try {
          const { error } = await supabase.from("profiles").upsert(
            {
              id: userId,
              full_name: meta?.full_name || meta?.name || user?.email || null,
              avatar_url: meta?.avatar_url || meta?.picture || null,
              tier: "FREE",
            },
            { onConflict: "id" },
          );
          if (!error) {
            data = await userService.getProfile(userId);
          }
        } catch (createErr) {
          console.error("Profile auto-create failed:", createErr);
        }
      }

      setProfile(data);
      if (data) {
        localStorage.setItem("deckly-user-profile", JSON.stringify(data));
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  };

  const refreshBranding = async (providedUserId?: string) => {
    const userId = providedUserId || session?.user?.id;
    if (userId) {
      const { deckService } = await import("../services/deckService");
      const data = await deckService.getBrandingSettings(userId);
      setBranding(data);
      if (data) {
        localStorage.setItem("deckly-branding-settings", JSON.stringify(data));
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety fallback: ensure loading is NEVER stuck for more than 15 seconds
    const safetyTimeout = setTimeout(() => {
      if (mounted && loadingRef.current) {
        console.warn(
          "[Auth Context] Initialization timed out (15s safety fallback)",
        );
        setLoading(false);
      }
    }, 15000);

    const initialize = async () => {
      // 1. Listen for auth changes (handles both initial and updates)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_, session) => {
        if (!mounted) return;

        setSession(session);

        if (session?.user) {
          // Fetch profile AND branding but don't strictly block the UI if it's slow
          fetchProfile(session.user.id);
          refreshBranding(session.user.id);
        } else {
          setProfile(null);
        }

        // Always stop loading after the first session discovery or event
        if (mounted && loadingRef.current) {
          setLoading(false);
          clearTimeout(safetyTimeout);
        }
      });

      // 2. Race the initial session fetch to detect slow connections
      try {
        const racePromise = Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 8000),
          ),
        ]);
        await (racePromise as any);
      } catch (err: any) {
        if (err.message === "timeout" && mounted) {
          setInitializationError("connection_slow");
        }
      }

      return subscription;
    };

    let authSubscription: { unsubscribe: () => void } | null = null;
    initialize().then((sub) => {
      authSubscription = sub;
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, []);

  const isPro = profile?.tier === "PRO" || profile?.tier === "PRO_PLUS";

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        branding,
        setBranding,
        loading,
        isPro,
        refreshProfile,
        refreshBranding,
        signOut,
        initializationError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
