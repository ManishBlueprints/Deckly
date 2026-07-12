type PostHogEnvironment = {
  VITE_PUBLIC_POSTHOG_KEY?: string;
  VITE_PUBLIC_POSTHOG_HOST?: string;
  VITE_POSTHOG_KEY?: string;
  VITE_POSTHOG_HOST?: string;
};

export function resolvePostHogConfig(environment: PostHogEnvironment) {
  return {
    apiKey:
      environment.VITE_PUBLIC_POSTHOG_KEY || environment.VITE_POSTHOG_KEY || "",
    apiHost:
      environment.VITE_PUBLIC_POSTHOG_HOST || environment.VITE_POSTHOG_HOST || "",
  };
}

export const posthogConfig = resolvePostHogConfig(import.meta.env);
