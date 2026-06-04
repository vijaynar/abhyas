// apps/web/src/app/api/v1/batches/route.ts
// GET  /api/v1/batches         — list all batches for the tenant (optionally filter by class)
// POST /api/v1/batches         — create a new batch (admin only)

import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';
import { CreateBatchSchema } from '@upasthiti/common';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get('classId');

    let query = adminDb()
      .from('batches')
      .select(`
        *,
        class:classes(id, name)
      `)
      .order('name', { ascending: true });

    if (ctx.role !== 'superadmin') {
      query = query.eq('tenant_id', ctx.tenantId);
    }

    if (classId) {
      query = query.eq('class_id', classId);
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
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const body = await req.json();
    const parsed = CreateBatchSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const db = adminDb();

    // Verify the class belongs to this tenant
    const classQuery = db
      .from('classes')
      .select('id, tenant_id')
      .eq('id', parsed.data.classId);

    if (ctx.role !== 'superadmin') {
      classQuery.eq('tenant_id', ctx.tenantId);
    }

    const { data: cls, error: clsErr } = await classQuery.maybeSingle();

    if (clsErr || !cls) return err('Class not found in your tenant', 404);

    const effectiveTenantId = cls.tenant_id;

    // Validate end_time > start_time at application level
    const [sh, sm] = parsed.data.startTime.split(':').map(Number);
    const [eh, em] = parsed.data.endTime.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      return err('End time must be after start time', 422);
    }

    const { data, error } = await db
      .from('batches')
      .insert({
        tenant_id: effectiveTenantId,
        class_id: parsed.data.classId,
        name: parsed.data.name,
        start_time: `${parsed.data.startTime}:00`,
        end_time: `${parsed.data.endTime}:00`,
        days_of_week: parsed.data.daysOfWeek,
        max_capacity: parsed.data.maxCapacity,
      })
      .select(`*, class:classes(id, name)`)
      .single();

    if (error) throw error;

    // If a coach creates a batch, auto-create a pending assignment for them
    if (ctx.role === 'coach') {
      await db.from('coach_batch_assignments').insert({
        tenant_id: effectiveTenantId,
        coach_id: ctx.userId,
        batch_id: data.id,
        status: 'pending',
        requested_by: ctx.userId,
      });
    }

    return created(data);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
