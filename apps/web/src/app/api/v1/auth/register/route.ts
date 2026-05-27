// apps/web/src/app/api/v1/auth/register/route.ts
// POST /api/v1/auth/register
// Public endpoint for self-serve Academy/Institute onboarding.
// Creates a fresh tenant + registers the first Admin user.

import { NextResponse } from 'next/server';
import { adminDb, ok, err, created } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName, phone, tenantName, tenantSlug, country, state, city, address } = body;

    // Simple validation
    if (!email || !password || !firstName || !lastName || !tenantName || !tenantSlug) {
      return err('Missing required onboarding fields.', 422);
    }

    const db = adminDb();

    // 1. Create the tenant first
    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .insert({
        name: tenantName,
        slug: tenantSlug.toLowerCase().trim(),
        subscription_status: 'trial',
        country: country || 'India',
        state: state || 'Telangana',
        city: city || 'Hyderabad',
        address: address || null
      })
      .select()
      .single();

    if (tenantError) {
      if (tenantError.message.includes('slug')) {
        return err('This institute URL slug is already taken.', 409);
      }
      throw tenantError;
    }

    // 2. Create the Admin user in Supabase Auth
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm for onboarding admins
      app_metadata: {
        tenant_id: tenant.id,
        role: 'admin',
      },
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authError) {
      // Rollback tenant creation if auth fails
      await db.from('tenants').delete().eq('id', tenant.id);
      if (authError.message.includes('already registered')) {
        return err('A user with this email is already registered.', 409);
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 3. Insert the Admin user profile in public.users
    const { data: profile, error: profileError } = await db
      .from('users')
      .insert({
        id: userId,
        tenant_id: tenant.id,
        email,
        role: 'admin',
        first_name: firstName,
        last_name: lastName,
        phone: phone ?? null,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback auth user & tenant if profile insertion fails
      await db.auth.admin.deleteUser(userId);
      await db.from('tenants').delete().eq('id', tenant.id);
      throw profileError;
    }

    return created({
      userId,
      email,
      role: 'admin',
      tenant,
      profile,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return err(message, 500);
  }
}
