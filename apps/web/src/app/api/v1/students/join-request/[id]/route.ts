import { getAuthContext, adminDb, ok, err, hasRole } from '@/lib/api';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);

    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (status !== 'approved' && status !== 'rejected') {
      return err('Invalid status value. Must be approved or rejected', 400);
    }

    const db = adminDb();

    // 1. Fetch the request
    const requestQuery = db
      .from('student_join_requests')
      .select('*')
      .eq('id', id);

    if (ctx.role !== 'superadmin') {
      requestQuery.eq('tenant_id', ctx.tenantId);
    }

    const { data: request, error: fetchErr } = await requestQuery.maybeSingle();

    if (fetchErr || !request) {
      return err('Join request not found', 404);
    }

    if (request.status !== 'pending') {
      return err('Request has already been processed', 400);
    }

    // 2. Perform actions based on approval status
    if (status === 'approved') {
      // Begin transaction-like updates
      // A. Update student's batch_id in students table
      const { error: studentUpdateErr } = await db
        .from('students')
        .update({ batch_id: request.batch_id })
        .eq('id', request.student_id);

      if (studentUpdateErr) throw studentUpdateErr;
    }

    // B. Update request status
    const { error: requestUpdateErr } = await db
      .from('student_join_requests')
      .update({ status })
      .eq('id', id);

    if (requestUpdateErr) throw requestUpdateErr;

    return ok({ success: true });
  } catch (e: unknown) {
    console.error('[Process Join Request API Error]:', e);
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
