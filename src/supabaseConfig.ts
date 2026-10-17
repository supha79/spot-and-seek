const missingConfigMessage = 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

export function resolveSupabaseConfig(url: string | undefined, anonKey: string | undefined) {
  const normalizedUrl = url?.trim() || null;
  const normalizedAnonKey = anonKey?.trim() || null;

  return {
    url: normalizedUrl,
    anonKey: normalizedAnonKey,
    error: normalizedUrl && normalizedAnonKey ? null : missingConfigMessage,
  };
}