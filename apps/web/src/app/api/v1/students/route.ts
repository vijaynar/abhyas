// apps/web/src/app/api/v1/students/route.ts
// GET  /api/v1/students        — list all students for the tenant
// POST /api/v1/students        — create a new student (admin only)
//
// Query params for GET:
//   ?batchId=uuid      filter by batch
//   ?status=active     filter by status (active|inactive|suspended)
//   ?search=arjun      search by name or custom ID
//   ?page=1&limit=50   pagination

import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';
import { CreateStudentSchema } from '@upasthiti/common';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    const status = searchParams.get('status') ?? 'active';
    const search = searchParams.get('search') ?? '';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50'));
    const offset = (page - 1) * limit;

    const db = adminDb();

    let query = db
      .from('students')
      .select(
        `
        *,
        user:users!inner(
          id, email, first_name, last_name, phone, avatar_url, is_active
        ),
        batch:batches(
          id, name, start_time, end_time,
          class:classes(id, name)
        ),
        face_count:student_face_samples(count)
        `,
        { count: 'exact' }
      )
      .eq('tenant_id', ctx.tenantId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (batchId) {
      query = query.eq('batch_id', batchId);
    }

    if (search) {
      query = query.or(
        `student_custom_id.ilike.%${search}%,user.first_name.ilike.%${search}%,user.last_name.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return ok({
      students: data,
      pagination: {
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);

    const body = await req.json();
    const parsed = CreateStudentSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 422);

    const {
      email, password, firstName, lastName, phone,
      studentCustomId, dateOfBirth, joiningDate,
      batchId, address, emergencyContact,
    } = parsed.data;

    const db = adminDb();

    // Generate Custom ID (Roll Number) automatically if not provided
    let customId = studentCustomId?.trim();
    if (!customId) {
      // Find the last generated roll number for the tenant in the "vsXXXXX" format
      const { data: lastStudent, error: lastStudentErr } = await db
        .from('students')
        .select('student_custom_id')
        .eq('tenant_id', ctx.tenantId)
        .like('student_custom_id', 'vs%')
        .order('student_custom_id', { ascending: false })
        .limit(1);

      if (lastStudentErr) {
        throw lastStudentErr;
      }

      let nextNum = 1;
      if (lastStudent && lastStudent.length > 0) {
        const lastId = lastStudent[0].student_custom_id;
        const match = lastId.match(/^vs(\d+)$/);
        if (match) {
          const lastNum = parseInt(match[1], 10);
          if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
          }
        }
      }
      customId = `vs${String(nextNum).padStart(5, '0')}`;
    }

    // Validate batch belongs to tenant if provided
    if (batchId) {
      const { data: batch } = await db
        .from('batches')
        .select('id')
        .eq('id', batchId)
        .eq('tenant_id', ctx.tenantId)
        .single();
      if (!batch) return err('Batch not found in your tenant', 404);
    }

    // 1. Create Supabase Auth user
    // Append roll number to the email local part (plus addressing) to ensure uniqueness in Supabase Auth
    // while keeping the original email in public.users to allow shared/duplicate parent emails.
    let authEmail = email;
    if (email.includes('@')) {
      const [localPart, domain] = email.split('@');
      authEmail = `${localPart}+${customId.toLowerCase()}@${domain}`;
    }

    const finalPassword = password || phone;
    if (!finalPassword) {
      return err('Password or Phone Number is required to provision student portal access.', 422);
    }

    const { data: authData, error: authError } =
      await db.auth.admin.createUser({
        email: authEmail,
        password: finalPassword,
        email_confirm: true,
        app_metadata: { tenant_id: ctx.tenantId, role: 'student' },
        user_metadata: { first_name: firstName, last_name: lastName },
      });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return err('A student user with this unique custom ID mapping already exists', 409);
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Insert users profile row
    const { error: userErr } = await db.from('users').insert({
      id: userId,
      tenant_id: ctx.tenantId,
      email,
      role: 'student',
      first_name: firstName,
      last_name: lastName,
      phone: phone ?? null,
    });

    if (userErr) {
      await db.auth.admin.deleteUser(userId);
      throw userErr;
    }

    // 3. Insert students extended profile
    const { data: student, error: studentErr } = await db
      .from('students')
      .insert({
        id: userId,
        tenant_id: ctx.tenantId,
        batch_id: batchId ?? null,
        student_custom_id: customId,
        date_of_birth: dateOfBirth,
        joining_date: joiningDate ?? new Date().toISOString().split('T')[0],
        address: address ?? null,
        emergency_contact: emergencyContact ?? null,
      })
      .select(`
        *,
        user:users(id, email, first_name, last_name, phone),
        batch:batches(id, name, start_time, end_time)
      `)
      .single();

    if (studentErr) {
      if (studentErr.code === '23505') {
        return err(`Student ID "${customId}" already exists`, 409);
      }
      await db.auth.admin.deleteUser(userId);
      throw studentErr;
    }

    return created(student);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
