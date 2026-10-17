import { loadEnv } from 'vite';

const env = process.env.VERCEL === '1' || process.env.CI === 'true'
  ? process.env
  : loadEnv('production', process.cwd(), 'VITE_');
const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((name) => !env[name]);

if (missing.length > 0) {
  console.error(`Production build requires: ${missing.join(', ')}`);
  process.exitCode = 1;
}
