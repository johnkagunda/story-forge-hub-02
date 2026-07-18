import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

// The publishable key (sb_publishable_*) is an opaque string, not a JWT.
// Supabase expects it in the `apikey` header only — not as a Bearer token.
const isPublishableKey = SUPABASE_ANON_KEY?.startsWith('sb_publishable_');

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(
        typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
      );
      if (init?.headers) {
        new Headers(init.headers).forEach((v, k) => headers.set(k, v));
      }
      // For publishable keys: set apikey but remove the invalid Bearer token
      if (isPublishableKey) {
        headers.set('apikey', SUPABASE_ANON_KEY);
        if (headers.get('Authorization') === `Bearer ${SUPABASE_ANON_KEY}`) {
          headers.delete('Authorization');
        }
      }
      return fetch(input, { ...init, headers });
    },
  },
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
