// apps/web/src/app/api/v1/auth/session/route.ts
// POST /api/v1/auth/session
// Called client-side after successful login to record last_login timestamp and login device.

import { getAuthContext, adminDb, ok, err } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const userAgent = req.headers.get('user-agent') || 'Unknown Device';
    
    // Parse a friendly device string from User-Agent
    let loginDevice = 'Unknown Device';
    if (userAgent) {
      if (/iPhone|iPad|iPod/.test(userAgent)) {
        loginDevice = 'Safari on iOS';
      } else if (/Android/.test(userAgent)) {
        const browser = /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : 'Browser';
        loginDevice = `${browser} on Android`;
      } else if (/Windows/.test(userAgent)) {
        const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : /Safari/.test(userAgent) ? 'Safari' : 'Browser';
        loginDevice = `${browser} on Windows`;
      } else if (/Macintosh|Mac OS/.test(userAgent)) {
        const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : /Safari/.test(userAgent) ? 'Safari' : 'Browser';
        loginDevice = `${browser} on macOS`;
      } else if (/Linux/.test(userAgent)) {
        const browser = /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : 'Browser';
        loginDevice = `${browser} on Linux`;
      } else {
        // Generic fallback
        const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome/.test(userAgent) ? 'Chrome' : /Firefox/.test(userAgent) ? 'Firefox' : /Safari/.test(userAgent) ? 'Safari' : 'Browser';
        loginDevice = browser;
      }
    }

    const db = adminDb();
    const { error: updateError } = await db
      .from('users')
      .update({
        last_login: new Date().toISOString(),
        login_device: loginDevice,
      })
      .eq('id', ctx.userId);

    if (updateError) {
      console.warn('[Session] Failed to update login tracking:', updateError.message);
      // Non-fatal — don't return error to client
    }

    return ok({ success: true, login_device: loginDevice });
  } catch (e: unknown) {
    console.error('[Session] Error:', e);
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
