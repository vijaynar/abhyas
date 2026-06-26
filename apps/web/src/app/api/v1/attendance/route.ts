// apps/web/src/app/api/v1/attendance/route.ts
// GET  /api/v1/attendance      — fetch attendance logs with filters
// POST /api/v1/attendance      — manual attendance override (admin only)
//
// GET query params:
//   ?date=2026-05-22              exact date
//   ?from=2026-05-01&to=2026-05-31  date range
//   ?batchId=uuid
//   ?studentId=uuid
//   ?status=present|late|absent
//   ?page=1&limit=50

import { NextResponse } from 'next/server';
import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';
import { ManualAttendanceSchema } from '@abhyas/common';
import { toDateString } from '@/lib/utils';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const batchId = searchParams.get('batchId');
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(200, parseInt(searchParams.get('limit') ?? '50'));
    const offset = (page - 1) * limit;

    const db = adminDb();

    let query = db
      .from('attendance_logs')
      .select(
        `
        *,
        student:students(
          id, student_custom_id,
          user:users(id, first_name, last_name, avatar_url)
        ),
        batch:batches(id, name, start_time, end_time)
        `,
        { count: 'exact' }
      )
      .order('date', { ascending: false })
      .order('check_in', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ctx.role !== 'superadmin') {
      query = query.eq('tenant_id', ctx.tenantId);
    }

    // Students can only see their own records
    if (ctx.role === 'student') {
      query = query.eq('student_id', ctx.userId);
    } else if (ctx.role === 'parent') {
      // Parents can see records of linked students
      const { data: links } = await db
        .from('parent_student_map')
        .select('student_id')
        .eq('parent_id', ctx.userId);
      const childIds = (links ?? []).map((l) => l.student_id);
      if (childIds.length === 0) return ok({ logs: [], pagination: { total: 0, page, limit, totalPages: 0 } });
      query = query.in('student_id', childIds);
    } else if (studentId) {
      query = query.eq('student_id', studentId);
    }

    if (date) {
      query = query.eq('date', date);
    } else if (from || to) {
      if (from) query = query.gte('date', from);
      if (to) query = query.lte('date', to);
    }

    if (batchId) query = query.eq('batch_id', batchId);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    return ok({
      logs: data,
      pagination: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) {
      return err('Forbidden: only admins can override attendance', 403);
    }

    const body = await req.json();
    const parsed = ManualAttendanceSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const { studentId, batchId, date, status, notes } = parsed.data;
    const db = adminDb();

    // Verify student and batch belong to this tenant (unless superadmin)
    const studentQuery = db.from('students').select('id, tenant_id').eq('id', studentId);
    const batchQuery = db.from('batches').select('id, tenant_id').eq('id', batchId);

    if (ctx.role !== 'superadmin') {
      studentQuery.eq('tenant_id', ctx.tenantId);
      batchQuery.eq('tenant_id', ctx.tenantId);
    }

    const [{ data: student }, { data: batch }] = await Promise.all([
      studentQuery.maybeSingle(),
      batchQuery.maybeSingle(),
    ]);

    if (!student) return err('Student not found in your tenant', 404);
    if (!batch) return err('Batch not found in your tenant', 404);

    const effectiveTenantId = student.tenant_id;

    // Upsert: update if record exists, insert if not
    const { data: log, error } = await db
      .from('attendance_logs')
      .upsert(
        {
          tenant_id: effectiveTenantId,
          student_id: studentId,
          batch_id: batchId,
          date,
          check_in: status !== 'absent' ? new Date().toISOString() : null,
          status,
          verification_mode: 'manual',
          confidence_score: null,
          verified_by: ctx.userId,
          notes: notes ?? null,
        },
        { onConflict: 'student_id,batch_id,date' }
      )
      .select()
      .single();

    if (error) throw error;

    // Auto-fine: if marking absent and auto_fine_enabled
    if (status === 'absent') {
      await createAbsenceFineIfEnabled(effectiveTenantId, studentId, log.id, date, db);
    }

    return created(log);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}


// ── Fine helper ───────────────────────────────────────────────

async function createAbsenceFineIfEnabled(
  tenantId: string,
  studentId: string,
  attendanceLogId: string,
  date: string,
  db: ReturnType<typeof adminDb>
) {
  // Load tenant settings
  const { data: settings } = await db
    .from('tenant_settings')
    .select('auto_fine_enabled, absent_fine_rule_1, absent_fine_rule_1_days, absent_fine_rule_2, currency')
    .eq('tenant_id', tenantId)
    .single();

  if (!settings?.auto_fine_enabled) return;

  // Count existing absences this month
  const monthStart = date.substring(0, 7) + '-01'; // YYYY-MM-01
  const { count: absenceCount } = await db
    .from('attendance_logs')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('student_id', studentId)
    .eq('status', 'absent')
    .gte('date', monthStart)
    .lte('date', date);

  const existing = (absenceCount ?? 1) - 1; // exclude the one we just created
  const fineAmount =
    existing < settings.absent_fine_rule_1_days
      ? settings.absent_fine_rule_1
      : settings.absent_fine_rule_2;

  await db.from('fines').insert({
    tenant_id: tenantId,
    student_id: studentId,
    attendance_log_id: attendanceLogId,
    amount: fineAmount,
    reason: `Absent on ${date} — auto-generated fine`,
    status: 'unpaid',
    issued_date: toDateString(),
  });
}
