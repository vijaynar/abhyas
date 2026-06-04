// apps/web/src/app/api/v1/attendance/match-group/route.ts
// POST /api/v1/attendance/match-group
//
// BATCH ATTENDANCE ENGINE FOR GROUP PHOTOS:
// 1. Receives an array of face embeddings: number[][]
// 2. Receives batchId and date
// 3. Runs pgvector similarity match in parallel for all embeddings
// 4. Logs matched students as present or late with verification_mode = 'face_photo'
// 5. Logs unmatched students as absent with auto-fines
// 6. Returns a summary of findings
//

import { getAuthContext, adminDb, ok, err } from '@/lib/api';
import { toDateString } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const body = await req.json();
    const { batchId, date, embeddings, simulate } = body;

    if (!batchId || !date || !Array.isArray(embeddings)) {
      return err('Missing batchId, date, or embeddings array', 422);
    }

    const db = adminDb();

    // 1. Validate batch belongs to tenant (unless superadmin)
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

    // 2. Get all students enrolled in this batch
    const { data: enrolledStudents, error: enrollErr } = await db
      .from('students')
      .select('id, student_custom_id, users!inner(first_name, last_name, email)')
      .eq('tenant_id', effectiveTenantId)
      .eq('batch_id', batchId);

    if (enrollErr) throw enrollErr;

    // Load settings for grace periods and auto-fines
    const { data: settings } = await db
      .from('tenant_settings')
      .select(
        'grace_period_minutes, late_threshold_minutes, auto_fine_enabled, absent_fine_rule_1, absent_fine_rule_1_days, absent_fine_rule_2'
      )
      .eq('tenant_id', effectiveTenantId)
      .single();

    const gracePeriod = settings?.grace_period_minutes ?? 0;
    const lateThreshold = settings?.late_threshold_minutes ?? 5;
    const autoFineEnabled = settings?.auto_fine_enabled ?? true;

    // Determine check-in timestamp and timings
    const now = new Date();
    const isToday = date === toDateString(now);
    const checkInTime = isToday ? now : new Date(`${date}T${batch.start_time}`);

    const [bh, bm] = batch.start_time.split(':').map(Number);
    const batchStart = new Date(checkInTime);
    batchStart.setHours(bh, bm, 0, 0);

    const minutesLate = Math.floor(
      (checkInTime.getTime() - batchStart.getTime()) / 60000
    );

    let baseStatus: 'present' | 'late' | 'absent' = 'present';
    if (minutesLate <= gracePeriod) {
      baseStatus = 'present';
    } else if (minutesLate <= gracePeriod + lateThreshold) {
      baseStatus = 'late';
    } else {
      baseStatus = 'absent';
    }

    // --- AI Simulation Bypass Mode ---
    if (simulate) {
      let enrolled: any[] = enrolledStudents || [];
      if (enrolled.length === 0) {
        enrolled = [
          { id: 'mock-1', student_custom_id: 'vs00001', users: { first_name: 'Arjun', last_name: 'Sharma', email: 'arjun@gmail.com' } },
          { id: 'mock-2', student_custom_id: 'vs00002', users: { first_name: 'Kabir', last_name: 'Dev', email: 'kabir@gmail.com' } },
          { id: 'mock-3', student_custom_id: 'vs00003', users: { first_name: 'Riya', last_name: 'Mehta', email: 'riya@gmail.com' } }
        ] as any[];
      }

      // Match up to the count of input embeddings
      const simulatedMatchedCount = Math.min(enrolled.length, Math.max(1, embeddings.length - 1));
      const simulatedMatched = enrolled.slice(0, simulatedMatchedCount).map((s) => ({
        id: s.id,
        name: `${s.users.first_name} ${s.users.last_name}`,
        studentCustomId: s.student_custom_id,
        similarity: Math.round((0.75 + Math.random() * 0.15) * 10000) / 100,
        status: baseStatus,
        logId: `sim-log-${s.id}`,
      }));

      const simulatedAbsent = enrolled.slice(simulatedMatchedCount).map((s) => ({
        id: s.id,
        name: `${s.users.first_name} ${s.users.last_name}`,
        studentCustomId: s.student_custom_id,
        status: 'absent' as const,
        logId: `sim-log-absent-${s.id}`,
      }));

      const simulatedDetections = embeddings.map((emb, idx) => {
        if (idx < simulatedMatched.length) {
          const match = simulatedMatched[idx];
          return {
            matched: true,
            studentId: match.id,
            name: match.name,
            studentCustomId: match.studentCustomId,
            similarity: match.similarity,
          };
        }
        return { matched: false };
      });

      return ok({
        success: true,
        batch: {
          id: batch.id,
          name: batch.name,
        },
        date,
        matchedCount: simulatedMatched.length,
        absentCount: simulatedAbsent.length,
        unrecognizedCount: Math.max(0, embeddings.length - simulatedMatched.length),
        matchedStudents: simulatedMatched,
        absentStudents: simulatedAbsent,
        detections: simulatedDetections,
      });
    }

    const matchedStudents: any[] = [];
    let unrecognizedCount = 0;

    // 3. Match each embedding in parallel using pgvector RPC
    const matchPromises = embeddings.map(async (embedding: number[]) => {
      try {
        const embeddingLiteral = `[${embedding.join(',')}]`;
        const { data: matches, error: matchErr } = await db.rpc(
          'match_face_embedding',
          {
            p_tenant_id: effectiveTenantId,
            input_embedding: embeddingLiteral,
            match_threshold: 0.60, // slightly more lenient for group photos
            match_count: 1,
          }
        );

        if (matchErr) {
          console.error('Database RPC match error:', matchErr);
          throw matchErr;
        }

        if (!matches || matches.length === 0) {
          unrecognizedCount++;
          return null;
        }

        const match = matches[0];
        const studentInfo = enrolledStudents?.find((s: any) => s.id === match.student_id);
        const studentCustomId = studentInfo ? studentInfo.student_custom_id : '';

        return {
          studentId: match.student_id as string,
          studentName: match.student_name as string,
          studentCustomId: studentCustomId,
          similarity: match.similarity as number,
        };
      } catch (err) {
        console.error('Embedding match failed:', err);
        throw err;
      }
    });

    const matchResults = await Promise.all(matchPromises);

    // Filter duplicates and nulls
    const uniqueMatchesMap = new Map<string, any>();
    for (const res of matchResults) {
      if (res && !uniqueMatchesMap.has(res.studentId)) {
        uniqueMatchesMap.set(res.studentId, res);
      }
    }

    // 4. Log matched students
    const upsertLogs = Array.from(uniqueMatchesMap.values()).map(async (match) => {
      try {
        // Upsert log
        const { data: log, error: logErr } = await db
          .from('attendance_logs')
          .upsert(
            {
              tenant_id: effectiveTenantId,
              student_id: match.studentId,
              batch_id: batchId,
              date,
              check_in: checkInTime.toISOString(),
              status: baseStatus,
              verification_mode: 'face_photo',
              confidence_score: Math.round(match.similarity * 10000) / 100,
              notes: 'Logged via daily group photo scan',
            },
            {
              onConflict: 'student_id,batch_id,date',
            }
          )
          .select()
          .single();

        if (logErr) {
          console.error('Database upsert log error:', logErr);
          throw logErr;
        }

        matchedStudents.push({
          id: match.studentId,
          name: match.studentName,
          studentCustomId: match.studentCustomId,
          similarity: Math.round(match.similarity * 10000) / 100,
          status: baseStatus,
          logId: log.id,
        });
      } catch (err) {
        console.error('Failed to log attendance for student:', match.studentId, err);
        throw err;
      }
    });

    await Promise.all(upsertLogs);

    // 5. Detect and log absent students
    const matchedIds = new Set(matchedStudents.map((s) => s.id));
    const absentStudents: any[] = [];

    const upsertAbsents = (enrolledStudents || []).map(async (student: any) => {
      if (matchedIds.has(student.id)) return;

      try {
        // Log absent
        const { data: log, error: logErr } = await db
          .from('attendance_logs')
          .upsert(
            {
              tenant_id: effectiveTenantId,
              student_id: student.id,
              batch_id: batchId,
              date,
              check_in: null,
              status: 'absent',
              verification_mode: 'face_photo',
              confidence_score: null,
              notes: 'Not detected in daily group photo scan',
            },
            {
              onConflict: 'student_id,batch_id,date',
            }
          )
          .select()
          .single();

        if (logErr) {
          console.error('Database upsert absent log error:', logErr);
          throw logErr;
        }

        absentStudents.push({
          id: student.id,
          name: `${(student as any).users.first_name} ${(student as any).users.last_name}`,
          studentCustomId: student.student_custom_id,
          status: 'absent',
          logId: log.id,
        });

        // Trigger auto-fine if enabled
        if (autoFineEnabled && log) {
          const monthStart = date.substring(0, 7) + '-01';
          const { count: absenceCount } = await db
            .from('attendance_logs')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', effectiveTenantId)
            .eq('student_id', student.id)
            .eq('status', 'absent')
            .gte('date', monthStart)
            .lte('date', date);

          const existing = Math.max(0, (absenceCount ?? 1) - 1);
          const fineAmount =
            existing < (settings?.absent_fine_rule_1_days ?? 4)
              ? (settings?.absent_fine_rule_1 ?? 1000)
              : (settings?.absent_fine_rule_2 ?? 2000);

          // Only create one fine per attendance log
          const { count: existingFines } = await db
            .from('fines')
            .select('id', { count: 'exact', head: true })
            .eq('attendance_log_id', log.id);

          if ((existingFines ?? 0) === 0) {
            const { error: fineErr } = await db.from('fines').insert({
              tenant_id: effectiveTenantId,
              student_id: student.id,
              attendance_log_id: log.id,
              amount: fineAmount,
              reason: `Absent on ${date} (not detected in group photo scan)`,
              status: 'unpaid',
              issued_date: date,
            });
            if (fineErr) {
              console.error('Database fine insert error:', fineErr);
              throw fineErr;
            }
          }
        }
      } catch (err) {
        console.error('Failed to log absence/fine for student:', student.id, err);
        throw err;
      }
    });

    await Promise.all(upsertAbsents);

    // Map 1-to-1 match results to input embeddings array to preserve indexes
    const detections = matchResults.map((res) => {
      if (!res) {
        return { matched: false };
      }
      return {
        matched: true,
        studentId: res.studentId,
        name: res.studentName,
        studentCustomId: res.studentCustomId,
        similarity: Math.round(res.similarity * 10000) / 100,
      };
    });

    return ok({
      success: true,
      batch: {
        id: batch.id,
        name: batch.name,
      },
      date,
      matchedCount: matchedStudents.length,
      absentCount: absentStudents.length,
      unrecognizedCount,
      matchedStudents,
      absentStudents,
      detections,
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
