// packages/database/src/server.ts
// Server-side Supabase admin client (for use in Next.js API route handlers only)
// Uses SERVICE ROLE KEY — bypasses RLS. NEVER import this in client components.

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[database/server] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables.'
    );
  }

  // Always create a fresh client — Next.js serverless functions don't persist
  // module-level state across invocations in the same way a Node.js server would.
  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
