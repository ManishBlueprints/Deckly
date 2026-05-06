/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_PUBLIC_POSTHOG_KEY: string
  readonly VITE_PUBLIC_POSTHOG_HOST: string
  readonly VITE_SENTRY_DSN: string
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string
  readonly VITE_TALLY_FEEDBACK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.svg";
declare module "*.gif";
