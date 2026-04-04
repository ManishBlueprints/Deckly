/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { UserProfile, BrandingSettings } from "../types";
import { useProfile, useBranding } from "../hooks/useAuthQueries";

interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isPro: boolean;
  refreshProfile: () => Promise<void>;
  branding: BrandingSettings | null;
  setBranding: (branding: BrandingSettings | null) => void;
  refreshBranding: () => Promise<void>;
  signOut: () => Promise<void>;
  initializationError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const loadingRef = React.useRef(true);

  // TanStack Queries
  const { data: profile } = useProfile(session?.user?.id);
  const { data: branding } = useBranding(session?.user?.id);

  // Sync ref with state
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  const refreshProfile = async () => {
    if (session?.user) {
      await queryClient.invalidateQueries({
        queryKey: ["profile", session.user.id],
      });
    }
  };

  const refreshBranding = async () => {
    if (session?.user) {
      await queryClient.invalidateQueries({
        queryKey: ["branding", session.user.id],
      });
    }
  };

  const setBranding = (newBranding: BrandingSettings | null) => {
    if (session?.user) {
      queryClient.setQueryData(["branding", session.user.id], newBranding);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety fallback: ensure loading is never stuck for more than 15 seconds
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
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        setSession(session);

        // Security: Automatically clear sensitive cache if session is signed out remotely
        if (event === "SIGNED_OUT") {
          queryClient.clear();
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
        await racePromise;
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "timeout" && mounted) {
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
  }, [queryClient]);

  const isPro = profile?.tier === "PRO" || profile?.tier === "PRO_PLUS";

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear(); // Clear all queries on sign out for security
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile: profile || null,
        branding: branding || null,
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
