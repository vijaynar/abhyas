// apps/web/src/app/api/v1/coaches/availability/route.ts
// GET  /api/v1/coaches/availability?coachId=...   — list weekly slots for a coach
// POST /api/v1/coaches/availability               — configure weekly schedule slots

import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) return err('coachId is required', 422);

    // Coaches can only view their own schedule; admins can view anyone
    if (ctx.role === 'coach' && coachId !== ctx.userId) {
      return err('Forbidden: coaches can only view their own availability', 403);
    }

    const db = adminDb();
    const { data: slots, error } = await db
      .from('coach_availability')
      .select('*')
      .eq('coach_id', coachId)
      .eq('tenant_id', ctx.tenantId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) throw error;
    return ok(slots);
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
    const { coachId, slots } = body; // slots: Array<{ dayOfWeek: number, startTime: string, endTime: string, isRecurring?: boolean }>

    if (!coachId || !Array.isArray(slots)) {
      return err('coachId and slots array are required', 422);
    }

    // Coaches can only configure their own schedule; admins can set it for anyone
    if (ctx.role === 'coach' && coachId !== ctx.userId) {
      return err('Forbidden: coaches can only configure their own availability', 403);
    }

    const db = adminDb();

    // Validate slots before performing transaction
    for (const slot of slots) {
      const { dayOfWeek, startTime, endTime } = slot;
      if (dayOfWeek < 1 || dayOfWeek > 7) {
        return err(`Invalid dayOfWeek: ${dayOfWeek}. Must be between 1 (Monday) and 7 (Sunday).`, 400);
      }
      if (!startTime || !endTime || startTime >= endTime) {
        return err(`Invalid time range: ${startTime} to ${endTime}. End time must be greater than start time.`, 400);
      }
    }

    // Use transaction/bulk-rewrite to update slots
    // 1. Delete existing slots
    const { error: delErr } = await db
      .from('coach_availability')
      .delete()
      .eq('coach_id', coachId)
      .eq('tenant_id', ctx.tenantId);

    if (delErr) throw delErr;

    // 2. Insert new slots if array not empty
    if (slots.length > 0) {
      const inserts = slots.map(slot => ({
        coach_id: coachId,
        tenant_id: ctx.tenantId,
        day_of_week: slot.dayOfWeek,
        start_time: slot.startTime,
        end_time: slot.endTime,
        is_recurring: slot.isRecurring ?? true,
      }));

      const { data: newSlots, error: insErr } = await db
        .from('coach_availability')
        .insert(inserts)
        .select();

      if (insErr) throw insErr;
      return created({ success: true, count: newSlots.length, slots: newSlots });
    }

    return ok({ success: true, count: 0, slots: [] });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
