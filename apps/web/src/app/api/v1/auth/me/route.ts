// apps/web/src/app/api/v1/auth/me/route.ts
// GET /api/v1/auth/me
// Returns the full profile of the currently authenticated user.
// Joins tenant info for the frontend to hydrate the session context.

import { getAuthContext, adminDb, ok, err } from '@/lib/api';

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const db = adminDb();

    // Fetch user profile with tenant name
    const { data: user, error } = await db
      .from('users')
      .select(`
        id,
        tenant_id,
        email,
        role,
        first_name,
        last_name,
        phone,
        avatar_url,
        is_active,
        created_at
      `)
      .eq('id', ctx.userId)
      .single();

    if (error || !user) return err('User profile not found', 404);

    // Fetch tenant details separately
    const { data: tenant } = await db
      .from('tenants')
      .select('id, name, slug, logo_url, subscription_status')
      .eq('id', ctx.tenantId)
      .single();

    return ok({
      ...user,
      full_name: `${user.first_name} ${user.last_name}`,
      tenant,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    return err(message, 500);
  }
}
