/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "../services/supabase";
import { TutorialState, UserProfile } from "../types";
import { useQueryClient } from "@tanstack/react-query";

interface TourContextType {
  hasCompletedTour: (tourId: keyof TutorialState) => boolean;
  markTourComplete: (tourId: keyof TutorialState) => Promise<void>;
  resetTours: () => Promise<void>;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { profile, session, profileLoading, profileError, refreshProfile } = useAuth();
  const queryClient = useQueryClient();

  const hasCompletedTour = useCallback(
    (tourId: keyof TutorialState) => {
      // No session → tours won't run anyway (no user to track)
      if (!session) return false;
      // Profile still loading → suppress tours to prevent false starts
      if (profileLoading) return true;
      // Profile fetch failed → allow tours (can't verify completion)
      if (profileError) return false;
      // Profile loaded but null → allow tours
      if (!profile) return false;

      return !!profile.tutorial_state?.[tourId];
    },
    [profile, session, profileLoading, profileError],
  );

  const markTourComplete = useCallback(
    async (tourId: keyof TutorialState) => {
      if (!session?.user?.id) return;

      const updateData: Partial<TutorialState> = { [tourId]: true };

      // Optimistic Update
      queryClient.setQueryData(
        ["profile", session.user.id],
        (old: UserProfile | undefined) => {
          if (!old) return old;
          return {
            ...old,
            tutorial_state: {
              ...old.tutorial_state,
              [tourId]: true,
            },
          };
        },
      );

      // Update backend via RPC
      const { error } = await supabase.rpc("update_tutorial_state", {
        p_state: updateData,
      });

      if (error) {
        console.error("Failed to update tutorial state", error);
        // Refresh to get actual server state on error
        refreshProfile();
      }
    },
    [session, queryClient, refreshProfile],
  );

  const resetTours = useCallback(async () => {
    if (!session?.user?.id) return;

    queryClient.setQueryData(
      ["profile", session.user.id],
      (old: UserProfile | undefined) => {
        if (!old) return old;
        return {
          ...old,
          tutorial_state: {},
        };
      },
    );

    // We can clear it by passing an empty JSON or setting specifically false flags
    // Since our RPC uses || (concatenation) in PostgreSQL, resetting requires
    // a different RPC or standard update. Let's just update the profile table directly.
    const { error } = await supabase
      .from("profiles")
      .update({ tutorial_state: {} })
      .eq("id", session.user.id);

    if (error) {
      console.error("Failed to reset tutorial state", error);
      refreshProfile();
    }
  }, [session, queryClient, refreshProfile]);

  const value = useMemo(
    () => ({
      hasCompletedTour,
      markTourComplete,
      resetTours,
    }),
    [hasCompletedTour, markTourComplete, resetTours],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};

export const useTourState = () => {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error("useTourState must be used within a TourProvider");
  }
  return context;
};
