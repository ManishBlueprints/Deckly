/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase";
import { userService } from "../services/userService";
import { UserProfile, BrandingSettings } from "../types";
import { useProfile, useBranding } from "../hooks/useAuthQueries";
import posthog from "posthog-js";
import {
  captureSignupCompleted,
  consumePendingOAuthSignup,
} from "../services/signupAnalytics";
import {
  createPasswordRecoveryMarker,
  isPasswordRecoveryMarkerActive,
} from "../utils/passwordRecoveryState";

interface AuthContextType {
  session: Session | null;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  profile: UserProfile | null;
  loading: boolean;
  isPro: boolean;
  refreshProfile: () => Promise<void>;
  branding: BrandingSettings | null;
  brandingLoading: boolean;
  brandingError: boolean;
  setBranding: (branding: BrandingSettings | null) => void;
  refreshBranding: () => Promise<void>;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  initializationError: string | null;
  profileLoading: boolean;
  profileError: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PASSWORD_RECOVERY_STORAGE_KEY = "deckly.password_recovery";

const readPasswordRecoveryState = () => {
  try {
    return isPasswordRecoveryMarkerActive(
      window.sessionStorage.getItem(PASSWORD_RECOVERY_STORAGE_KEY),
    );
  } catch {
    return false;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(readPasswordRecoveryState);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(
    null,
  );
  const loadingRef = React.useRef(true);

  // TanStack Queries
  const { data: profile, isLoading: profileLoading, isError: profileError } =
    useProfile(session?.user?.id);
  const { data: branding, isLoading: brandingLoading, isError: brandingError } =
    useBranding(session?.user?.id);

  // Sync PostHog Identity
  useEffect(() => {
    if (session?.user) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        full_name: profile?.full_name,
      });
      Sentry.setUser({
        id: session.user.id,
        email: session.user.email,
        username: profile?.full_name || undefined,
      });
    } else if (!loading) {
      // Only reset if we are sure there is no session (loading is finished)
      posthog.reset();
      Sentry.setUser(null);
    }
  }, [session, profile, loading]);

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

  const clearPasswordRecovery = () => {
    setPasswordRecovery(false);
    try {
      window.sessionStorage.removeItem(PASSWORD_RECOVERY_STORAGE_KEY);
    } catch {
      // Recovery state is only an in-browser guard; storage failures are non-fatal.
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

        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecovery(true);
          try {
            window.sessionStorage.setItem(
              PASSWORD_RECOVERY_STORAGE_KEY,
              createPasswordRecoveryMarker(),
            );
          } catch {
            // The active recovery session remains sufficient for this browser visit.
          }
        } else {
          // PASSWORD_RECOVERY is the only Supabase event that proves the
          // active session originated from a recovery link. Never let a
          // previous recovery marker authorize a normal signed-in session.
          clearPasswordRecovery();
        }

        // OAuth returns through a full-page redirect, so the signup page cannot
        // capture completion itself. Consume the intent exactly once when the
        // authenticated session is restored.
        if (session?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          const signupMethod = consumePendingOAuthSignup();
          const createdAt = Date.parse(session.user.created_at);
          const isRecentlyCreated =
            Number.isFinite(createdAt) &&
            Date.now() - createdAt <= 15 * 60 * 1000;
          if (signupMethod && isRecentlyCreated) {
            captureSignupCompleted(session.user, signupMethod);
          }
        }

        // Security: Automatically clear sensitive cache if session is signed out remotely
        if (event === "SIGNED_OUT") {
          clearPasswordRecovery();
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
    queryClient.clear();
  };

  const signOutAllDevices = async () => {
    // scope: 'global' revokes ALL refresh tokens across every device/browser
    await supabase.auth.signOut({ scope: "global" });
    queryClient.clear();
  };

  const deleteAccount = async () => {
    await userService.deleteAccount();
    // The auth row is gone — clear local state and redirect
    queryClient.clear();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out after deletion failed (best effort):", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        passwordRecovery,
        clearPasswordRecovery,
        profile: profile || null,
        branding: branding || null,
        brandingLoading,
        brandingError,
        setBranding,
        loading,
        isPro,
        refreshProfile,
        refreshBranding,
        signOut,
        signOutAllDevices,
        deleteAccount,
        initializationError,
        profileLoading,
        profileError,
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
