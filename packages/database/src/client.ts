// packages/database/src/client.ts
// Browser-safe Supabase client (for use in React components and client-side hooks)
// Uses ANON key — respects RLS policies.

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
