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

        // Record last_login and login_device (best-effort, non-fatal)
        try {
          const userAgent = request.headers.get('user-agent') || '';
          let loginDevice = 'Unknown Device';
          if (/iPhone|iPad|iPod/.test(userAgent)) {
            loginDevice = 'Safari on iOS';
          } else if (/Android/.test(userAgent)) {
            const b = /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : 'Browser';
            loginDevice = `${b} on Android`;
          } else if (/Windows/.test(userAgent)) {
            const b = /Edg\//.test(userAgent) ? 'Edge' : /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : /Safari/.test(userAgent) ? 'Safari' : 'Browser';
            loginDevice = `${b} on Windows`;
          } else if (/Macintosh|Mac OS/.test(userAgent)) {
            const b = /Edg\//.test(userAgent) ? 'Edge' : /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : /Safari/.test(userAgent) ? 'Safari' : 'Browser';
            loginDevice = `${b} on macOS`;
          } else if (/Linux/.test(userAgent)) {
            const b = /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : 'Browser';
            loginDevice = `${b} on Linux`;
          }
          await supabase
            .from('users')
            .update({ last_login: new Date().toISOString(), login_device: loginDevice })
            .eq('id', user.id);
          console.log('[Auth Callback] Login tracking updated:', loginDevice);
        } catch (trackErr) {
          console.warn('[Auth Callback] Login tracking failed (non-fatal):', trackErr);
        }

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
