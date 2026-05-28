// apps/web/src/app/api/v1/coaches/route.ts
// GET  /api/v1/coaches        — list all active coaches for the tenant
// POST /api/v1/coaches        — onboard a new coach (admin only)
// PUT  /api/v1/coaches        — update coach profile / deactivate (admin or self)

import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const withEarnings = searchParams.get('withEarnings') === 'true';

    const db = adminDb();

    // Build coaches query joining users + coaches profile + batch assignments
    let query = db
      .from('users')
      .select(`
        id, email, first_name, last_name, phone, avatar_url, is_active, role,
        coach_profile:coaches(
          expertise, availability_slots, hourly_rate, certificates, created_at
        ),
        batch_assignments:coach_batch_assignments!coach_batch_assignments_coach_id_fkey(
          id, status, batch_id,
          batch:batches(id, name, start_time, end_time, days_of_week,
            class:classes(name)
          )
        )
      `)
      .eq('tenant_id', ctx.tenantId)
      .eq('role', 'coach');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: coaches, error } = await query.order('first_name', { ascending: true });
    if (error) throw error;

    // If earnings requested, compute sessions × hourly_rate per coach
    if (withEarnings && coaches) {
      const approvedBatchIds = coaches.flatMap((c: any) =>
        (c.batch_assignments || [])
          .filter((a: any) => a.status === 'approved')
          .map((a: any) => a.batch_id)
      );

      let sessionCounts: Record<string, number> = {};
      if (approvedBatchIds.length > 0) {
        const { data: sessions } = await db
          .from('attendance_logs')
          .select('batch_id, date')
          .eq('tenant_id', ctx.tenantId)
          .in('batch_id', approvedBatchIds);

        // Count unique dates per batch
        if (sessions) {
          const batchDateSets: Record<string, Set<string>> = {};
          sessions.forEach((s: any) => {
            if (!batchDateSets[s.batch_id]) batchDateSets[s.batch_id] = new Set();
            batchDateSets[s.batch_id].add(s.date);
          });
          Object.entries(batchDateSets).forEach(([batchId, dates]) => {
            sessionCounts[batchId] = dates.size;
          });
        }
      }

      return ok(coaches.map((coach: any) => {
        const approved = (coach.batch_assignments || []).filter((a: any) => a.status === 'approved');
        const totalSessions = approved.reduce((sum: number, a: any) =>
          sum + (sessionCounts[a.batch_id] || 0), 0);
        const hourlyRate = coach.coach_profile?.hourly_rate ?? 500;
        return {
          ...coach,
          earnings: {
            totalSessions,
            hourlyRate,
            estimated: totalSessions * hourlyRate,
          }
        };
      }));
    }

    return ok(coaches);
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
    const { email, password, firstName, lastName, phone, expertise, availabilitySlots, hourlyRate, avatarUrl } = body;

    if (!email || !password || !firstName || !lastName) {
      return err('email, password, firstName, and lastName are required', 422);
    }

    const db = adminDb();

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: ctx.tenantId, role: 'coach' },
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return err('A user with this email already exists', 409);
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Insert users profile row
    const { error: userErr } = await db.from('users').insert({
      id: userId,
      tenant_id: ctx.tenantId,
      email,
      role: 'coach',
      first_name: firstName,
      last_name: lastName,
      phone: phone ?? null,
      avatar_url: avatarUrl ?? null,
    });

    if (userErr) {
      await db.auth.admin.deleteUser(userId);
      throw userErr;
    }

    // 3. Insert coaches extended profile
    const { data: coach, error: coachErr } = await db
      .from('coaches')
      .insert({
        id: userId,
        tenant_id: ctx.tenantId,
        expertise: expertise ?? null,
        availability_slots: availabilitySlots ?? null,
        hourly_rate: hourlyRate ?? 500,
        certificates: [],
      })
      .select()
      .single();

    if (coachErr) {
      await db.auth.admin.deleteUser(userId);
      throw coachErr;
    }

    return created({ userId, coach });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const body = await req.json();
    const { coachId, action, ...fields } = body;

    if (!coachId) return err('coachId is required', 422);

    const db = adminDb();

    // Coaches can only update their own profile; admins can update anyone
    if (ctx.role === 'coach' && coachId !== ctx.userId) {
      return err('Forbidden: coaches can only update their own profile', 403);
    }

    // Action: deactivate — admin only
    if (action === 'deactivate') {
      if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);
      const { error } = await db
        .from('users')
        .update({ is_active: false })
        .eq('id', coachId)
        .eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true, message: 'Coach deactivated' });
    }

    // Action: reactivate — admin only
    if (action === 'reactivate') {
      if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);
      const { error } = await db
        .from('users')
        .update({ is_active: true })
        .eq('id', coachId)
        .eq('tenant_id', ctx.tenantId);
      if (error) throw error;
      return ok({ success: true, message: 'Coach reactivated' });
    }

    // Action: update coach profile fields
    const coachUpdate: Record<string, unknown> = {};
    if (fields.expertise !== undefined) coachUpdate.expertise = fields.expertise;
    if (fields.availabilitySlots !== undefined) coachUpdate.availability_slots = fields.availabilitySlots;
    if (fields.hourlyRate !== undefined) coachUpdate.hourly_rate = fields.hourlyRate;
    if (fields.certificates !== undefined) coachUpdate.certificates = fields.certificates;

    if (Object.keys(coachUpdate).length > 0) {
      coachUpdate.updated_at = new Date().toISOString();
      const { error: coachErr } = await db
        .from('coaches')
        .update(coachUpdate)
        .eq('id', coachId)
        .eq('tenant_id', ctx.tenantId);
      if (coachErr) throw coachErr;
    }

    // Optionally update user fields
    const userUpdate: Record<string, unknown> = {};
    // Admins can update name; both admins and coaches can update phone
    if (hasRole(ctx, 'admin', 'superadmin')) {
      if (fields.firstName !== undefined) userUpdate.first_name = fields.firstName;
      if (fields.lastName !== undefined) userUpdate.last_name = fields.lastName;
    }
    if (fields.phone !== undefined) userUpdate.phone = fields.phone;
    if (fields.avatarUrl !== undefined) userUpdate.avatar_url = fields.avatarUrl;

    if (Object.keys(userUpdate).length > 0) {
      const { error: userErr } = await db
        .from('users')
        .update(userUpdate)
        .eq('id', coachId)
        .eq('tenant_id', ctx.tenantId);
      if (userErr) throw userErr;
    }

    return ok({ success: true });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
