import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookieStorage } from './cookieStorage.ts'

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

let cachedSupabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Missing Supabase environment variables')
  }

  if (!cachedSupabase) {
    cachedSupabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: cookieStorage,
        storageKey: 'deckly-auth-token',
      },
    })
  }

  return cachedSupabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabase()
    const value = Reflect.get(client, prop, receiver)

    if (typeof value === 'function') {
      return value.bind(client)
    }

    return value
  },
}) as SupabaseClient
