// apps/web/src/app/api/v1/auth/signup/route.ts
// POST /api/v1/auth/signup
// Creates a new Supabase auth user + inserts a profile row in `users`.
// Can be called by:
//   - A superadmin creating an admin account for a new tenant
//   - An admin creating a student or parent account
// Access: admin, superadmin only

import { NextResponse } from 'next/server';
import { SignupSchema } from '@upasthiti/common';
import { ok, err, created, getAuthContext, adminDb, hasRole } from '@/lib/api';

export async function POST(req: Request) {
  try {
    // ── Auth check ──────────────────────────────────────────
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) {
      return err('Forbidden: only admins can create users', 403);
    }

    // ── Validate body ───────────────────────────────────────
    const body = await req.json();
    const parsed = SignupSchema.safeParse(body);
    if (!parsed.success) {
      return err(parsed.error.errors[0].message, 422);
    }

    const { email, password, firstName, lastName, phone, role, tenantId } =
      parsed.data;

    // Superadmins can create in any tenant; admins only in their own
    const effectiveTenantId =
      ctx.role === 'superadmin' ? tenantId : ctx.tenantId;

    if (ctx.role === 'admin' && tenantId !== ctx.tenantId) {
      return err('Forbidden: cannot create users in another tenant', 403);
    }

    const db = adminDb();

    // ── Create Supabase Auth user ───────────────────────────
    const { data: authData, error: authError } =
      await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // auto-confirm for admin-created accounts
        app_metadata: {
          tenant_id: effectiveTenantId,
          role,
        },
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return err('A user with this email already exists', 409);
      }
      throw authError;
    }

    const userId = authData.user.id;

    // ── Insert profile row in public.users ──────────────────
    const { data: profile, error: profileError } = await db
      .from('users')
      .insert({
        id: userId,
        tenant_id: effectiveTenantId,
        email,
        role: role as 'admin' | 'student' | 'parent',
        first_name: firstName,
        last_name: lastName,
        phone: phone ?? null,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback: delete the auth user if profile insert fails
      await db.auth.admin.deleteUser(userId);
      throw profileError;
    }

    return created({
      userId,
      email,
      role,
      tenantId: effectiveTenantId,
      profile,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return err(message, 500);
  }
}
