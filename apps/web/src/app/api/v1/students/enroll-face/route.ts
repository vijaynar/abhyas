// apps/web/src/app/api/v1/students/enroll-face/route.ts
// POST /api/v1/students/enroll-face
// Saves a 128-float face embedding vector (computed client-side via face-api.js)
// alongside the photo URL for a given student.
// Access: admin only

import { getAuthContext, adminDb, created, err, hasRole } from '@/lib/api';
import { FaceEnrollSchema } from '@upasthiti/common';
import { FACE_MATCH_EMBEDDING_DIMENSIONS } from '@upasthiti/common';

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) {
      return err('Forbidden: only admins can enroll faces', 403);
    }

    const body = await req.json();
    const parsed = FaceEnrollSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const { studentId, photoUrl, embedding, label } = parsed.data;

    // Validate embedding dimensions
    if (embedding.length !== FACE_MATCH_EMBEDDING_DIMENSIONS) {
      return err(
        `Embedding must have exactly ${FACE_MATCH_EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`,
        422
      );
    }

    // Validate all values are finite floats
    if (embedding.some((v) => !Number.isFinite(v))) {
      return err('Embedding contains non-finite values (NaN or Infinity)', 422);
    }

    const db = adminDb();

    // Verify student belongs to this tenant
    const { data: student, error: studentErr } = await db
      .from('students')
      .select('id, tenant_id')
      .eq('id', studentId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (studentErr || !student) {
      return err('Student not found in your tenant', 404);
    }

    // Check max samples per student (limit to 5 to keep vectors focused)
    const { count } = await db
      .from('student_face_samples')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId);

    if ((count ?? 0) >= 5) {
      return err(
        'Maximum of 5 face samples per student. Delete an existing sample to add a new one.',
        409
      );
    }

    // Insert face sample — embedding formatted as PostgreSQL vector literal
    const embeddingLiteral = `[${embedding.join(',')}]`;

    const { data: sample, error } = await db
      .from('student_face_samples')
      .insert({
        student_id: studentId,
        tenant_id: ctx.tenantId,
        photo_url: photoUrl,
        embedding: embeddingLiteral as unknown as number[],
        label: label ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return created({
      sampleId: sample.id,
      studentId,
      label: sample.label,
      createdAt: sample.created_at,
      totalSamples: (count ?? 0) + 1,
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

// DELETE /api/v1/students/enroll-face?sampleId=uuid
// Removes a specific face sample for a student (admin only)
export async function DELETE(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const sampleId = searchParams.get('sampleId');
    if (!sampleId) return err('sampleId query param is required', 422);

    const db = adminDb();

    const { error } = await db
      .from('student_face_samples')
      .delete()
      .eq('id', sampleId)
      .eq('tenant_id', ctx.tenantId); // tenant isolation

    if (error) throw error;

    return new Response(null, { status: 204 });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
