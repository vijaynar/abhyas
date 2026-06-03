// apps/web/src/app/auth/callback/route.ts
// Handles the Supabase auth callback (exchanges ?code= for a session and redirects).

import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  console.log('[Auth Callback] Initiating auth callback code exchange...', { code: code ? 'Present' : 'Missing' });

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set({ name, value, ...options })
              );
            } catch (err) {
              // Ignore cookie writing issues from inside Route Handlers
              console.warn('[Auth Callback] Cookie set warning:', err);
            }
          },
        },
      }
    );

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error('[Auth Callback] Session exchange failed:', error.message);
        throw error;
      }

      const user = data?.user;
      if (user) {
        console.log('[Auth Callback] Session active. User authenticated:', user.id, user.email);

        // Fetch user profile role from public database table to determine dashboard redirection
        // Falls back to student trigger values or app metadata if not loaded yet
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        const role = profile?.role || user.app_metadata?.role || 'student';
        console.log('[Auth Callback] Resolved user role:', role);

        if (role === 'student' || role === 'parent') {
          console.log('[Auth Callback] Redirecting to student dashboard...');
          return NextResponse.redirect(`${origin}/student/dashboard`);
        } else {
          console.log('[Auth Callback] Redirecting to admin dashboard...');
          return NextResponse.redirect(`${origin}/admin/dashboard`);
        }
      }
    } catch (err: any) {
      console.error('[Auth Callback] Error handling authorization:', err.message);
      return NextResponse.redirect(`${origin}/auth/login?error=callback-failed&msg=${encodeURIComponent(err.message)}`);
    }
  }

  // Fallback if code exchange wasn't started or fails silently
  console.log('[Auth Callback] No authorization code found. Ejecting to login...');
  return NextResponse.redirect(`${origin}/auth/login?error=invalid-callback`);
}
