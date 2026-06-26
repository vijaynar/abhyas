// apps/web/src/app/api/v1/settings/route.ts
// GET  /api/v1/settings        — get tenant configuration
// PATCH /api/v1/settings       — update tenant configuration (admin only)

import { getAuthContext, adminDb, ok, err, hasPermission } from '@/lib/api';
import { UpdateTenantSettingsSchema } from '@abhyas/common';

export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const db = adminDb();
    const targetTenantId = ctx.role === 'superadmin' 
      ? '00000000-0000-0000-0000-000000000000' 
      : ctx.tenantId;

    // 1. Fetch active settings for the target tenant
    let { data, error } = await db
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', targetTenantId)
      .maybeSingle();

    if (error) throw error;

    // 2. If not found and the caller is an Admin, load the Global System Defaults
    if (!data && targetTenantId !== '00000000-0000-0000-0000-000000000000') {
      const { data: globalDefaults, error: globalErr } = await db
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', '00000000-0000-0000-0000-000000000000')
        .maybeSingle();

      if (!globalErr && globalDefaults) {
        data = {
          ...globalDefaults,
          tenant_id: ctx.tenantId
        };
      }
    }

    // 3. Fallback defaults if no settings record exists in database
    if (!data) {
      return ok({
        tenant_id: targetTenantId,
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
    
    // Check permission dynamically from database
    if (!await hasPermission(ctx, 'settings', 'manage')) {
      return err('Forbidden', 403);
    }

    const body = await req.json();
    const parsed = UpdateTenantSettingsSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const db = adminDb();
    const targetTenantId = ctx.role === 'superadmin' 
      ? '00000000-0000-0000-0000-000000000000' 
      : ctx.tenantId;

    // Upsert settings scoped to targetTenantId
    const { data, error } = await db
      .from('tenant_settings')
      .upsert(
        {
          tenant_id: targetTenantId,
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
