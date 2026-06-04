// apps/web/src/app/api/v1/classes/route.ts
// GET  /api/v1/classes        — list all classes for the tenant
// POST /api/v1/classes        — create a new class (admin only)

import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';
import { CreateClassSchema } from '@upasthiti/common';

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    let query = adminDb()
      .from('classes')
      .select('*')
      .order('name', { ascending: true });

    if (ctx.role !== 'superadmin') {
      query = query.eq('tenant_id', ctx.tenantId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return ok(data);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);

    const body = await req.json();
    const parsed = CreateClassSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const db = adminDb();
    const effectiveTenantId = ctx.role === 'superadmin' ? (body.tenantId || ctx.tenantId) : ctx.tenantId;

    const { data, error } = await db
      .from('classes')
      .insert({
        tenant_id: effectiveTenantId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return err(`A class named "${parsed.data.name}" already exists`, 409);
      }
      throw error;
    }

    return created(data);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
