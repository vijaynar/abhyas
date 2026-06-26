// apps/web/src/app/api/v1/attendance/match-face/route.ts
// POST /api/v1/attendance/match-face
//
// THE CORE ATTENDANCE ENGINE:
// 1. Receives a 128-float face embedding computed client-side (face-api.js / TF.js)
// 2. Runs pgvector cosine similarity match against all enrolled faces in the tenant
// 3. Determines attendance status: present | late | absent (using batch timing + grace period)
// 4. Writes the attendance_log row (idempotent — upserts on student+batch+date)
// 5. Auto-generates a fine if absent/late and auto_fine_enabled
// 6. Returns the matched student info and logged status
//
// Access: any authenticated user (admin, student self-scan, parent)

import { getAuthContext, adminDb, ok, err } from '@/lib/api';
import { FaceMatchSchema } from '@abhyas/common';
import {
  FACE_MATCH_THRESHOLD_CONFIDENT,
  FACE_MATCH_THRESHOLD_REVIEW,
} from '@abhyas/common';
import { toDateString } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const body = await req.json();
    const parsed = FaceMatchSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const { embedding, batchId } = parsed.data;
    const db = adminDb();

    // ── 1. Validate batch belongs to this tenant (unless superadmin) ───────────
    const batchQuery = db
      .from('batches')
      .select('id, name, start_time, tenant_id, is_active')
      .eq('id', batchId);

    if (ctx.role !== 'superadmin') {
      batchQuery.eq('tenant_id', ctx.tenantId);
    }

    const { data: batch, error: batchErr } = await batchQuery.maybeSingle();

    if (batchErr || !batch) return err('Batch not found in your tenant', 404);
    if (!batch.is_active) return err('Batch is not active', 422);

    const effectiveTenantId = batch.tenant_id;

    // ── 2. pgvector cosine similarity match ────────────────
    const embeddingLiteral = `[${embedding.join(',')}]`;

    const { data: matches, error: matchErr } = await db.rpc(
      'match_face_embedding',
      {
        p_tenant_id: effectiveTenantId,
        input_embedding: embeddingLiteral,
        match_threshold: FACE_MATCH_THRESHOLD_REVIEW, // 0.65 minimum
        match_count: 1,
      }
    );

    if (matchErr) throw matchErr;

    // No face matched
    if (!matches || matches.length === 0) {
      return ok({
        matchFound: false,
        message: 'Face not recognised. Please try again or contact admin.',
      });
    }

    const match = matches[0];
    const similarity = match.similarity as number;
    const studentId = match.student_id as string;
    const studentName = match.student_name as string;
    const matchedBatchId = match.batch_id as string | null;

    // ── 3. Check confidence level ──────────────────────────
    const isHighConfidence = similarity >= FACE_MATCH_THRESHOLD_CONFIDENT;
    const needsReview = !isHighConfidence; // 0.65–0.74: flag for admin review

    // ── 4. Determine attendance status using batch timings ─
    const now = new Date();
    const today = toDateString(now);

    // Load tenant settings for grace period rules
    const { data: settings } = await db
      .from('tenant_settings')
      .select(
        'grace_period_minutes, late_threshold_minutes, auto_fine_enabled, absent_fine_rule_1, absent_fine_rule_1_days, absent_fine_rule_2'
      )
      .eq('tenant_id', effectiveTenantId)
      .single();

    const gracePeriod = settings?.grace_period_minutes ?? 0;
    const lateThreshold = settings?.late_threshold_minutes ?? 5;

    // Parse batch start_time "HH:MM:SS" into today's Date
    const [bh, bm] = batch.start_time.split(':').map(Number);
    const batchStart = new Date(now);
    batchStart.setHours(bh, bm, 0, 0);

    const minutesLate = Math.floor(
      (now.getTime() - batchStart.getTime()) / 60000
    );

    let status: 'present' | 'late' | 'absent';
    if (minutesLate <= gracePeriod) {
      status = 'present';
    } else if (minutesLate <= gracePeriod + lateThreshold) {
      status = 'late';
    } else {
      // Far beyond the threshold — mark as absent with face verification mode
      // (Admin may override later)
      status = 'absent';
    }

    // ── 5. Upsert attendance log (idempotent) ─────────────
    const { data: log, error: logErr } = await db
      .from('attendance_logs')
      .upsert(
        {
          tenant_id: effectiveTenantId,
          student_id: studentId,
          batch_id: batchId,
          date: today,
          check_in: now.toISOString(),
          status,
          verification_mode: 'face_live',
          confidence_score: Math.round(similarity * 10000) / 100, // e.g. 97.42
          verified_by: null,
          notes: needsReview ? 'Low confidence — pending admin review' : null,
        },
        {
          onConflict: 'student_id,batch_id,date',
          ignoreDuplicates: true, // first check-in wins — prevents double logging
        }
      )
      .select()
      .single();

    if (logErr) throw logErr;

    // ── 6. Auto-fine if absent ─────────────────────────────
    if (status === 'absent' && settings?.auto_fine_enabled && log) {
      const monthStart = today.substring(0, 7) + '-01';
      const { count: absenceCount } = await db
        .from('attendance_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', effectiveTenantId)
        .eq('student_id', studentId)
        .eq('status', 'absent')
        .gte('date', monthStart)
        .lte('date', today);

      const existing = Math.max(0, (absenceCount ?? 1) - 1);
      const fineAmount =
        existing < (settings.absent_fine_rule_1_days ?? 4)
          ? (settings.absent_fine_rule_1 ?? 1000)
          : (settings.absent_fine_rule_2 ?? 2000);

      // Only create one fine per attendance log
      const { count: existingFines } = await db
        .from('fines')
        .select('id', { count: 'exact', head: true })
        .eq('attendance_log_id', log.id);

      if ((existingFines ?? 0) === 0) {
        await db.from('fines').insert({
          tenant_id: effectiveTenantId,
          student_id: studentId,
          attendance_log_id: log.id,
          amount: fineAmount,
          reason: `Absent on ${today} (face scan — ${Math.round(similarity * 100)}% match)`,
          status: 'unpaid',
          issued_date: today,
        });
      }
    }

    // ── 7. Return result ───────────────────────────────────
    return ok({
      matchFound: true,
      needsAdminReview: needsReview,
      confidence: Math.round(similarity * 10000) / 100,
      attendanceStatus: status,
      minutesLate: Math.max(0, minutesLate - gracePeriod),
      student: {
        id: studentId,
        name: studentName,
        batchId: matchedBatchId,
      },
      batch: {
        id: batch.id,
        name: batch.name,
      },
      log,
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
