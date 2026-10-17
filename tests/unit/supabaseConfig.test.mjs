import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSupabaseConfig } from '../../src/supabaseConfig.ts';

const missingConfigMessage = 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

test('accepts a complete Supabase config and trims whitespace', () => {
  assert.deepEqual(
    resolveSupabaseConfig(' https://spot-and-seek.test.invalid ', ' test-anon-key '),
    {
      url: 'https://spot-and-seek.test.invalid',
      anonKey: 'test-anon-key',
      error: null,
    },
  );
});

test('rejects a missing Supabase URL without dropping the key', () => {
  assert.deepEqual(resolveSupabaseConfig(undefined, 'test-anon-key'), {
    url: null,
    anonKey: 'test-anon-key',
    error: missingConfigMessage,
  });
});

test('rejects a missing Supabase anonymous key without dropping the URL', () => {
  assert.deepEqual(resolveSupabaseConfig('https://spot-and-seek.test.invalid', undefined), {
    url: 'https://spot-and-seek.test.invalid',
    anonKey: null,
    error: missingConfigMessage,
  });
});

test('treats whitespace-only Supabase config values as missing', () => {
  assert.deepEqual(resolveSupabaseConfig('  ', '\t'), {
    url: null,
    anonKey: null,
    error: missingConfigMessage,
  });
});