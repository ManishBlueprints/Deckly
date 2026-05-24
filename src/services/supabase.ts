import { createClient } from '@supabase/supabase-js'

type ImportMetaEnvShape = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

const viteEnv = (import.meta as ImportMeta & { env?: ImportMetaEnvShape }).env
const denoRuntime = globalThis as typeof globalThis & {
  Deno?: { env?: { get: (key: string) => string | undefined } }
}
const denoEnv = denoRuntime.Deno?.env ?? null

const supabaseUrl =
  viteEnv?.VITE_SUPABASE_URL ??
  denoEnv?.get('SUPABASE_URL') ??
  ''

const supabasePublishableKey =
  viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  denoEnv?.get('SUPABASE_ANON_KEY') ??
  denoEnv?.get('SUPABASE_PUBLISHABLE_KEY') ??
  ''

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
