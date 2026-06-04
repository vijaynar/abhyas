import { getAuthContext, adminDb, ok, err, hasRole, created } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const db = adminDb();

    let query = db
      .from('student_join_requests')
      .select(`
        *,
        batch:batches(id, name, class:classes(name)),
        student:students(
          id, student_custom_id,
          user:users(first_name, last_name, email)
        )
      `)
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false });

    // Students can only see their own requests
    if (ctx.role === 'student') {
      query = query.eq('student_id', ctx.userId);
    } else if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) {
      return err('Forbidden', 403);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ok({ joinRequests: data || [] });
  } catch (e: unknown) {
    console.error('[Get Join Requests API Error]:', e);
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'student')) return err('Forbidden', 403);

    const body = await req.json();
    const { batchId, remark } = body;

    if (!batchId) {
      return err('Batch ID is required', 400);
    }

    const db = adminDb();

    // Verify batch exists in current tenant
    const { data: batch, error: batchErr } = await db
      .from('batches')
      .select('id')
      .eq('id', batchId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (batchErr || !batch) {
      return err('Invalid Batch ID or batch does not belong to tenant', 404);
    }

    // Insert join request
    const { data: request, error: insertErr } = await db
      .from('student_join_requests')
      .insert({
        tenant_id: ctx.tenantId,
        student_id: ctx.userId,
        batch_id: batchId,
        remark: remark || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return created(request);
  } catch (e: unknown) {
    console.error('[Post Join Request API Error]:', e);
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
