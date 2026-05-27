// apps/web/src/app/api/v1/settings/route.ts
// GET  /api/v1/settings        — get tenant configuration
// PATCH /api/v1/settings       — update tenant configuration (admin only)

import { getAuthContext, adminDb, ok, err, hasRole } from '@/lib/api';
import { UpdateTenantSettingsSchema } from '@upasthiti/common';

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const { data, error } = await adminDb()
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle();

    if (error) throw error;

    // Return defaults if no settings row exists yet
    if (!data) {
      return ok({
        tenant_id: ctx.tenantId,
        absent_fine_rule_1: 1000,
        absent_fine_rule_1_days: 4,
        absent_fine_rule_2: 2000,
        late_threshold_minutes: 5,
        grace_period_minutes: 0,
        currency: 'INR',
        holidays: [],
        weekends: [6, 7],
        auto_fine_enabled: true,
      });
    }

    return ok(data);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);

    const body = await req.json();
    const parsed = UpdateTenantSettingsSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const db = adminDb();

    // Upsert settings — creates the row if it doesn't exist
    const { data, error } = await db
      .from('tenant_settings')
      .upsert(
        {
          tenant_id: ctx.tenantId,
          ...(parsed.data.absentFineRule1 !== undefined && {
            absent_fine_rule_1: parsed.data.absentFineRule1,
          }),
          ...(parsed.data.absentFineRule1Days !== undefined && {
            absent_fine_rule_1_days: parsed.data.absentFineRule1Days,
          }),
          ...(parsed.data.absentFineRule2 !== undefined && {
            absent_fine_rule_2: parsed.data.absentFineRule2,
          }),
          ...(parsed.data.lateThresholdMinutes !== undefined && {
            late_threshold_minutes: parsed.data.lateThresholdMinutes,
          }),
          ...(parsed.data.gracePeriodMinutes !== undefined && {
            grace_period_minutes: parsed.data.gracePeriodMinutes,
          }),
          ...(parsed.data.currency !== undefined && {
            currency: parsed.data.currency,
          }),
          ...(parsed.data.holidays !== undefined && {
            holidays: parsed.data.holidays,
          }),
          ...(parsed.data.weekends !== undefined && {
            weekends: parsed.data.weekends,
          }),
          ...(parsed.data.autoFineEnabled !== undefined && {
            auto_fine_enabled: parsed.data.autoFineEnabled,
          }),
        },
        { onConflict: 'tenant_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return ok(data);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
