// apps/web/src/lib/supabase.ts
// Supabase client instances for the web app.
// Imports directly from package source files via tsconfig paths.

import { createClient } from '@supabase/supabase-js';
import { createBrowserClient as _createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../../../packages/database/src/types';

export type { Database };

/** Browser-safe Supabase client — uses anon key, respects RLS */
export function createBrowserClient(): any {
  return _createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as any;
}

/** Server-side admin client — uses service role key, bypasses RLS */
export function createAdminClient(): any {
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  ) as any;
}
