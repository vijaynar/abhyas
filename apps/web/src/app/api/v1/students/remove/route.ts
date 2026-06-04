import { getAuthContext, adminDb, ok, err, hasRole } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const body = await req.json();
    const { studentId, remark } = body;

    if (!studentId) {
      return err('Student ID is required', 400);
    }

    const db = adminDb();

    // 1. Fetch student current profile (unless superadmin)
    const studentQuery = db
      .from('students')
      .select('id, batch_id, tenant_id')
      .eq('id', studentId);

    if (ctx.role !== 'superadmin') {
      studentQuery.eq('tenant_id', ctx.tenantId);
    }

    const { data: student, error: getErr } = await studentQuery.maybeSingle();

    if (getErr) throw getErr;
    if (!student) {
      return err('Student profile not found in your tenant', 404);
    }

    if (!student.batch_id) {
      return err('Student is not currently enrolled in any batch', 400);
    }

    const oldBatchId = student.batch_id;
    const effectiveTenantId = student.tenant_id;

    // 2. Clear batch_id on student profile
    const { error: updateErr } = await db
      .from('students')
      .update({ batch_id: null })
      .eq('id', studentId);

    if (updateErr) throw updateErr;

    // 3. Log removal record
    const { error: logErr } = await db
      .from('student_removals')
      .insert({
        tenant_id: effectiveTenantId,
        student_id: studentId,
        batch_id: oldBatchId,
        remark: remark || null,
      });

    if (logErr) throw logErr;

    return ok({ success: true });
  } catch (e: unknown) {
    console.error('[Student Removal API Error]:', e);
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
