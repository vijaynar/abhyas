// GET /api/v1/governance/audit-logs — Paginated audit trail for current tenant

import { getAuthContext, adminDb, ok, err, hasPermission } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!await hasPermission(ctx, 'audit_logs', 'view')) return err('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '50');
    const module = searchParams.get('module') ?? '';
    const userId = searchParams.get('userId') ?? '';
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const db = adminDb();
    let query = db
      .from('audit_logs')
      .select('*, users(first_name, last_name, email, role)', { count: 'exact' })
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (module) query = query.ilike('action', `${module}.%`);
    if (userId) query = query.eq('user_id', userId);

    const { data: logs, error: logsErr, count } = await query;
    if (logsErr) throw logsErr;

    return ok({ logs: logs ?? [], total: count ?? 0, page, limit });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
