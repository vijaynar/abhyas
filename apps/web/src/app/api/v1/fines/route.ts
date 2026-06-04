// apps/web/src/app/api/v1/fines/route.ts
// GET  /api/v1/fines           — list fines for the tenant (multi-role aware)
// POST /api/v1/fines           — manually create a fine (admin only)
//
// GET query params:
//   ?studentId=uuid
//   ?status=unpaid|paid|waived
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD
//   ?page=1&limit=50

import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';
import { toDateString } from '@/lib/utils';
import { z } from 'zod';

const CreateFineSchema = z.object({
  studentId: z.string().uuid(),
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
});

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));
    const offset = (page - 1) * limit;

    const db = adminDb();

    let query = db
      .from('fines')
      .select(
        `
        *,
        student:students(
          id, student_custom_id,
          user:users(id, first_name, last_name, avatar_url)
        )
        `,
        { count: 'exact' }
      )
      .order('issued_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (ctx.role !== 'superadmin') {
      query = query.eq('tenant_id', ctx.tenantId);
    }

    // Role-based data scoping
    if (ctx.role === 'student') {
      query = query.eq('student_id', ctx.userId);
    } else if (ctx.role === 'parent') {
      const { data: links } = await db
        .from('parent_student_map')
        .select('student_id')
        .eq('parent_id', ctx.userId);
      const childIds = (links ?? []).map((l) => l.student_id);
      if (childIds.length === 0) {
        return ok({ fines: [], pagination: { total: 0, page, limit, totalPages: 0 } });
      }
      query = query.in('student_id', childIds);
    } else if (studentId) {
      // Admin filtering by student
      query = query.eq('student_id', studentId);
    }

    if (status) query = query.eq('status', status);
    if (from) query = query.gte('issued_date', from);
    if (to) query = query.lte('issued_date', to);

    const { data, error, count } = await query;
    if (error) throw error;

    // Aggregate summary
    const totalUnpaid =
      data?.reduce(
        (sum, f) => (f.status === 'unpaid' ? sum + Number(f.amount) : sum),
        0
      ) ?? 0;

    return ok({
      fines: data,
      summary: { totalUnpaid },
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
      return err('Forbidden: only admins can manually create fines', 403);
    }

    const body = await req.json();
    const parsed = CreateFineSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const { studentId, amount, reason } = parsed.data;
    const db = adminDb();

    // Verify student belongs to tenant (unless superadmin)
    const studentQuery = db.from('students').select('id, tenant_id').eq('id', studentId);
    if (ctx.role !== 'superadmin') {
      studentQuery.eq('tenant_id', ctx.tenantId);
    }
    const { data: student } = await studentQuery.maybeSingle();

    if (!student) return err('Student not found in your tenant', 404);

    const effectiveTenantId = student.tenant_id;

    const { data: fine, error } = await db
      .from('fines')
      .insert({
        tenant_id: effectiveTenantId,
        student_id: studentId,
        amount,
        reason,
        status: 'unpaid',
        issued_date: toDateString(),
      })
      .select(`
        *,
        student:students(
          id, student_custom_id,
          user:users(id, first_name, last_name)
        )
      `)
      .single();

    if (error) throw error;
    return created(fine);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
