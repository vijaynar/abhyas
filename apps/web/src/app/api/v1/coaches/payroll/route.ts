// apps/web/src/app/api/v1/coaches/payroll/route.ts
// GET  /api/v1/coaches/payroll?coachId=...   — list historical payouts for a coach
// POST /api/v1/coaches/payroll               — generate/recalculate payout draft (admin only)

import { getAuthContext, adminDb, ok, err, hasRole } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) return err('coachId is required', 422);

    // Coaches can only view their own payouts; admins can view anyone
    if (ctx.role === 'coach' && coachId !== ctx.userId) {
      return err('Forbidden: coaches can only view their own payroll logs', 403);
    }

    const db = adminDb();
    const { data: payouts, error } = await db
      .from('coach_payouts')
      .select('*')
      .eq('coach_id', coachId)
      .eq('tenant_id', ctx.tenantId)
      .order('period_start', { ascending: false });

    if (error) throw error;
    return ok(payouts);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403); // Admin-only payroll generation

    const body = await req.json();
    const { coachId, periodStart, periodEnd, incentives, deductions } = body;

    if (!coachId || !periodStart || !periodEnd) {
      return err('coachId, periodStart, and periodEnd are required', 422);
    }

    const db = adminDb();

    // 1. Fetch coach financial settings
    const { data: settings, error: setErr } = await db
      .from('coach_financial_settings')
      .select('*')
      .eq('coach_id', coachId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (setErr || !settings) {
      return err('Coach financial settings not configured yet.', 404);
    }

    // 2. Fetch coach attendance count in period
    const { data: attendance, error: attErr } = await db
      .from('coach_attendance')
      .select('status')
      .eq('coach_id', coachId)
      .eq('tenant_id', ctx.tenantId)
      .gte('date', periodStart)
      .lte('date', periodEnd);

    if (attErr) throw attErr;

    const totalDays = attendance?.length ?? 0;
    const presentDays = attendance?.filter(a => ['present', 'late'].includes(a.status)).length ?? 0;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 100.00;

    // 3. Fetch conducted classes/sessions count
    // Get approved batch assignments
    const { data: assignments, error: assignErr } = await db
      .from('coach_batch_assignments')
      .select('batch_id')
      .eq('coach_id', coachId)
      .eq('status', 'approved');

    if (assignErr) throw assignErr;
    const batchIds = assignments?.map(a => a.batch_id) ?? [];

    let sessionsConducted = 0;
    if (batchIds.length > 0) {
      // Sessions conducted = unique dates where student attendance was taken for these batches
      const { data: sessions, error: sessErr } = await db
        .from('attendance_logs')
        .select('batch_id, date')
        .eq('tenant_id', ctx.tenantId)
        .in('batch_id', batchIds)
        .gte('date', periodStart)
        .lte('date', periodEnd);

      if (sessErr) throw sessErr;

      const dateSets: Record<string, Set<string>> = {};
      sessions?.forEach(s => {
        if (!dateSets[s.batch_id]) dateSets[s.batch_id] = new Set();
        dateSets[s.batch_id].add(s.date);
      });

      sessionsConducted = Object.values(dateSets).reduce((sum, dates) => sum + dates.size, 0);
    }

    // 4. Calculate dynamic earnings
    let baseSalaryEarned = 0.00;
    let classRateEarned = 0.00;
    let revenueShareEarned = 0.00;

    // Fixed monthly pro-rata logic: if attendance rate is below 95%, apply pro-rata deductions
    if (settings.salary_type === 'Fixed Monthly' || settings.salary_type === 'Hybrid') {
      const base = Number(settings.fixed_salary);
      if (attendanceRate >= 95.00 || totalDays === 0) {
        baseSalaryEarned = base;
      } else {
        baseSalaryEarned = base * (presentDays / (totalDays * 0.95)); // minor pro-rata deduction
      }
    }

    // Per-class logic
    if (settings.salary_type === 'Per Class' || settings.salary_type === 'Hybrid') {
      classRateEarned = sessionsConducted * Number(settings.per_class_rate);
    }

    // Revenue share logic
    if (settings.salary_type === 'Revenue Share' || settings.salary_type === 'Hybrid') {
      // Sum student fees active in coach batches. For simulation/compilation, we can calculate active student counts.
      // Suppose each student generates standard revenue of ₹5000/month. We calculate active mapped students.
      const { data: activeStudents, error: studErr } = await db
        .from('students')
        .select('id')
        .in('batch_id', batchIds)
        .eq('status', 'active');

      if (studErr) throw studErr;
      const studentCount = activeStudents?.length ?? 0;
      const calculatedRevenue = studentCount * 5000.00; // Estimated monthly class revenue
      revenueShareEarned = calculatedRevenue * (Number(settings.revenue_share_pct) / 100);
    }

    const netPayout = baseSalaryEarned + classRateEarned + revenueShareEarned + (Number(incentives) || 0) - (Number(deductions) || 0);

    // 5. Upsert payout record (Draft mode)
    // Check if payout record already exists in Draft/Processing state to update
    const { data: existingPayout } = await db
      .from('coach_payouts')
      .select('id')
      .eq('coach_id', coachId)
      .eq('tenant_id', ctx.tenantId)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd)
      .in('status', ['Draft', 'Processing'])
      .maybeSingle();

    let payout;
    if (existingPayout) {
      const { data, error: upErr } = await db
        .from('coach_payouts')
        .update({
          base_salary_earned: baseSalaryEarned,
          class_sessions_conducted: sessionsConducted,
          class_rate_earned: classRateEarned,
          revenue_share_earned: revenueShareEarned,
          incentives: Number(incentives) || 0.00,
          deductions: Number(deductions) || 0.00,
          net_payout: Math.max(0.00, netPayout),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPayout.id)
        .select()
        .single();

      if (upErr) throw upErr;
      payout = data;
    } else {
      const { data, error: insErr } = await db
        .from('coach_payouts')
        .insert({
          coach_id: coachId,
          tenant_id: ctx.tenantId,
          period_start: periodStart,
          period_end: periodEnd,
          base_salary_earned: baseSalaryEarned,
          class_sessions_conducted: sessionsConducted,
          class_rate_earned: classRateEarned,
          revenue_share_earned: revenueShareEarned,
          incentives: Number(incentives) || 0.00,
          deductions: Number(deductions) || 0.00,
          net_payout: Math.max(0.00, netPayout),
          status: 'Draft'
        })
        .select()
        .single();

      if (insErr) throw insErr;
      payout = data;
    }

    return ok({
      success: true,
      recalculated: !!existingPayout,
      attendanceRate,
      sessionsConducted,
      payout
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
