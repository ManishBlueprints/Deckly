import { supabase } from './supabase';
import { UserProfile } from '../types';
import { withRetry } from '../utils/resilience';
import { normalizeHandle } from '../utils/slug';

const profileCache = new Map<string, { data: UserProfile | null; timestamp: number }>();

export const userService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const cacheKey = `profile-${userId}`;
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
      return cached.data;
    }

    return withRetry(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error(`[User Service] Error fetching profile:`, error);
        return null;
      }

      const result = data as UserProfile | null;

      // Auto-generate handle if missing and full_name exists
      if (result && !result.handle && result.full_name) {
        const generatedHandle = normalizeHandle(result.full_name);
        if (generatedHandle) {
          try {
            const updated = await userService.updateProfile(userId, { handle: generatedHandle });
            profileCache.set(cacheKey, { data: updated, timestamp: Date.now() });
            return updated;
          } catch (e) {
            console.error("[User Service] Failed to auto-generate handle:", e);
          }
        }
      }

      profileCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    });
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      throw error;
    }

    // Clear cache on update
    profileCache.delete(`profile-${userId}`);
    return data;
  }
};
