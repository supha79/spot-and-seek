import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './supabaseConfig';

const config = resolveSupabaseConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const supabaseConfigError = config.error;

export const supabase =
  config.url && config.anonKey ? createClient(config.url, config.anonKey) : null;