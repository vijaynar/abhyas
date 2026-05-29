// apps/web/src/lib/api.ts
// Helpers for building consistent API responses and extracting auth context
// in Next.js route handlers.

import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ── Supabase DB type (inline to avoid workspace resolution issues in tsc) ───
// When supabase gen types is run, replace this with the generated file
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = any;

// ── Response builders ─────────────────────────────────────────

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function err(message: string, status = 400, code?: string) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

// ── Typed DB client ───────────────────────────────────────────

/**
 * Returns a Supabase admin client (service role key).
 * This bypasses RLS — ONLY use in server-side route handlers.
 */
export function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}

// ── Auth context ──────────────────────────────────────────────

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

/**
 * Extract and validate the calling user's session from cookies.
 * Returns AuthContext or null if not authenticated.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  const role = user.app_metadata?.role as string | undefined;

  if (!tenantId || !role) return null;

  return {
    userId: user.id,
    tenantId,
    role,
    email: user.email ?? '',
  };
}

/**
 * Require a specific role (or one of multiple roles).
 */
export function hasRole(ctx: AuthContext, ...roles: string[]): boolean {
  return roles.includes(ctx.role);
}

/**
 * Write an operational audit log entry to public.audit_logs.
 * Call this after any significant create/update/delete action.
 */
export async function logAuditEvent(
  tenantId: string,
  userId: string,
  action: string,
  description: string,
  ipAddress?: string
): Promise<void> {
  try {
    const db = adminDb();
    await db.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: userId,
      action,
      description,
      ip_address: ipAddress ?? null,
    });
  } catch (e) {
    // Audit logging must never crash the main operation
    console.error('[AuditLog] Failed to write audit log:', e);
  }
}
