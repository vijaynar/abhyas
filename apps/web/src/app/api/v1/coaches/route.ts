// apps/web/src/app/api/v1/coaches/route.ts
// GET  /api/v1/coaches        — list all coaches for the tenant
// POST /api/v1/coaches        — onboard a new coach (admin only)
// PUT  /api/v1/coaches        — update coach profile / activate / deactivate (admin or self)

import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';

// Generate a simple, unique SEO-friendly slug
function generateSlug(firstName: string, lastName: string): string {
  const base = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${base}-${rand}`;
}

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const db = adminDb();

    // Build coaches query joining users + coaches profile + batch assignments
    let query = db
      .from('users')
      .select(`
        id, email, first_name, last_name, phone, avatar_url, is_active, role,
        coach_profile:coaches!inner(
          primary_skill, experience_years, service_types, class_types, languages_known,
          qualification, certifications_summary, joining_date, bio, country, state, city,
          area, account_status, public_profile_slug, achievements, gallery_urls,
          avg_rating, retention_rate, conversion_rate, satisfaction_score, created_at
        ),
        batch_assignments:coach_batch_assignments!coach_batch_assignments_coach_id_fkey(
          id, status, batch_id,
          batch:batches(id, name, start_time, end_time, days_of_week,
            class:classes(name)
          )
        )
      `);

    if (ctx.role !== 'superadmin') {
      query = query.eq('tenant_id', ctx.tenantId);
    }

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data: coaches, error } = await query.order('first_name', { ascending: true });
    if (error) throw error;

    return ok(coaches);
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
    const { 
      email, password, firstName, lastName, phone, avatarUrl,
      primarySkill, experienceYears, serviceTypes, classTypes, languagesKnown,
      qualification, certificationsSummary, joiningDate, bio,
      country, state, city, area, address, specialization,
      salaryType, fixedSalary, perClassRate, revenueSharePct,
      bankAccountNumber, bankIfscCode, bankName, upiId, panNumber, tenantId
    } = body;

    if (!email || !password || !firstName || !lastName || !primarySkill || experienceYears === undefined) {
      return err('email, password, firstName, lastName, primarySkill, and experienceYears are required', 422);
    }

    const db = adminDb();
    const effectiveTenantId = ctx.role === 'superadmin' ? (tenantId || ctx.tenantId) : ctx.tenantId;

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: effectiveTenantId, role: 'coach' },
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return err('A user with this email already exists', 409);
      }
      throw authError;
    }

    // Fetch the global Coach role ID
    const { data: coachRole } = await db
      .from('roles')
      .select('id')
      .eq('name', 'Coach')
      .is('tenant_id', null)
      .maybeSingle();

    const userId = authData.user.id;

    // 2. Insert users profile row (Coaches require admin document verification before activation)
    const { error: userErr } = await db.from('users').upsert({
      id: userId,
      tenant_id: effectiveTenantId,
      email,
      role: 'coach',
      role_id: coachRole?.id || null,
      available_roles: ['coach'],
      first_name: firstName,
      last_name: lastName,
      phone: phone ?? null,
      avatar_url: avatarUrl ?? null,
      is_active: false, // Inactive by default until documents are verified
    });

    if (userErr) {
      await db.auth.admin.deleteUser(userId);
      throw userErr;
    }

    // 3. Insert coaches extended profile
    const slug = generateSlug(firstName, lastName);
    const { data: coach, error: coachErr } = await db
      .from('coaches')
      .insert({
        id: userId,
        tenant_id: effectiveTenantId,
        primary_skill: primarySkill,
        experience_years: Number(experienceYears),
        service_types: serviceTypes ?? ['Offline'],
        class_types: classTypes ?? ['Group Classes'],
        languages_known: languagesKnown ?? ['English'],
        qualification: qualification ?? null,
        certifications_summary: certificationsSummary ?? null,
        joining_date: joiningDate ? new Date(joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        bio: bio ?? null,
        country: country ?? 'India',
        state: state ?? null,
        city: city ?? null,
        area: area ?? null,
        address: address ?? null,
        designation: primarySkill,
        specialization: specialization ?? null,
        account_status: 'Onboarding',
        public_profile_slug: slug,
        achievements: [],
        gallery_urls: [],
        avg_rating: 0.00,
        retention_rate: 0.00,
        conversion_rate: 0.00,
        satisfaction_score: 0.00
      })
      .select()
      .single();

    if (coachErr) {
      await db.auth.admin.deleteUser(userId);
      throw coachErr;
    }

    // 4. Insert coach financial settings
    const { error: finErr } = await db.from('coach_financial_settings').insert({
      coach_id: userId,
      tenant_id: effectiveTenantId,
      salary_type: salaryType ?? 'Fixed Monthly',
      fixed_salary: fixedSalary ? Number(fixedSalary) : 0.00,
      per_class_rate: perClassRate ? Number(perClassRate) : 0.00,
      revenue_share_pct: revenueSharePct ? Number(revenueSharePct) : 0.00,
      bank_account_number: bankAccountNumber ?? null,
      bank_ifsc_code: bankIfscCode ?? null,
      bank_name: bankName ?? null,
      upi_id: upiId ?? null,
      pan_number: panNumber ?? null
    });

    if (finErr) {
      // Cleanup to maintain database integrity
      await db.from('coaches').delete().eq('id', userId);
      await db.from('users').delete().eq('id', userId);
      await db.auth.admin.deleteUser(userId);
      throw finErr;
    }

    return created({ userId, coach });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const body = await req.json();
    const { coachId, action, ...fields } = body;

    if (!coachId) return err('coachId is required', 422);

    const db = adminDb();

    // Coaches can only update their own profile; admins can update anyone
    if (ctx.role === 'coach' && coachId !== ctx.userId) {
      return err('Forbidden: coaches can only update their own profile', 403);
    }

    // Verify coach belongs to tenant (unless superadmin)
    const coachQuery = db.from('users').select('id, tenant_id').eq('id', coachId).eq('role', 'coach');
    if (ctx.role !== 'superadmin') {
      coachQuery.eq('tenant_id', ctx.tenantId);
    }
    const { data: coachProfile, error: coachProfileErr } = await coachQuery.maybeSingle();
    if (coachProfileErr || !coachProfile) {
      return err('Coach not found in your tenant', 404);
    }
    const effectiveTenantId = coachProfile.tenant_id;

    // Action: deactivate — admin only
    if (action === 'deactivate') {
      if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);
      const { error: userErr } = await db
        .from('users')
        .update({ is_active: false })
        .eq('id', coachId);
      if (userErr) throw userErr;

      const { error: coachErr } = await db
        .from('coaches')
        .update({ account_status: 'Inactive' })
        .eq('id', coachId);
      if (coachErr) throw coachErr;

      return ok({ success: true, message: 'Coach deactivated' });
    }

    // Action: reactivate / approve — admin only
    if (action === 'reactivate' || action === 'approve') {
      if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);
      
      // Verification check: ensure Government ID is uploaded and Verified
      if (action === 'approve') {
        const { data: docs, error: docsErr } = await db
          .from('coach_documents')
          .select('document_type, verification_status')
          .eq('coach_id', coachId);
        
        if (docsErr) throw docsErr;

        const hasVerifiedGovtId = docs?.some(d => d.document_type === 'Government ID' && d.verification_status === 'Verified');

        if (!hasVerifiedGovtId) {
          return err('Cannot activate coach: Government ID must be uploaded and verified first.', 400);
        }
      }

      // Fetch the global Coach role ID
      const { data: coachRole } = await db
        .from('roles')
        .select('id')
        .eq('name', 'Coach')
        .is('tenant_id', null)
        .maybeSingle();

      // Update role to 'coach' in public.users
      const { error: userErr } = await db
        .from('users')
        .update({ 
          is_active: true, 
          role: 'coach',
          role_id: coachRole?.id || null
        })
        .eq('id', coachId);
      if (userErr) throw userErr;

      // Update role to 'coach' in Supabase Auth user metadata
      const { error: authErr } = await db.auth.admin.updateUserById(coachId, {
        app_metadata: { role: 'coach', tenant_id: effectiveTenantId }
      });
      if (authErr) {
        console.warn('[Coach Approval] Auth metadata update warning:', authErr.message);
      }

      const { error: coachErr } = await db
        .from('coaches')
        .update({ account_status: 'Active' })
        .eq('id', coachId);
      if (coachErr) throw coachErr;

      return ok({ success: true, message: 'Coach activated and marked active.' });
    }

    // Action: update coach profile fields
    const coachUpdate: Record<string, any> = {};
    if (fields.primarySkill !== undefined) {
      coachUpdate.primary_skill = fields.primarySkill;
    } else if (fields.expertise !== undefined) {
      coachUpdate.primary_skill = fields.expertise;
    }
    if (fields.experienceYears !== undefined) coachUpdate.experience_years = Number(fields.experienceYears);
    if (fields.serviceTypes !== undefined) coachUpdate.service_types = fields.serviceTypes;
    if (fields.classTypes !== undefined) coachUpdate.class_types = fields.classTypes;
    if (fields.languagesKnown !== undefined) coachUpdate.languages_known = fields.languagesKnown;
    if (fields.qualification !== undefined) coachUpdate.qualification = fields.qualification;
    if (fields.certificationsSummary !== undefined) coachUpdate.certifications_summary = fields.certificationsSummary;
    if (fields.joiningDate !== undefined) coachUpdate.joining_date = fields.joiningDate || null;
    if (fields.bio !== undefined) coachUpdate.bio = fields.bio;
    if (fields.country !== undefined) coachUpdate.country = fields.country;
    if (fields.state !== undefined) coachUpdate.state = fields.state;
    if (fields.city !== undefined) coachUpdate.city = fields.city;
    if (fields.area !== undefined) coachUpdate.area = fields.area;
    if (fields.publicProfileSlug !== undefined) coachUpdate.public_profile_slug = fields.publicProfileSlug;
    if (fields.achievements !== undefined) coachUpdate.achievements = fields.achievements;
    if (fields.galleryUrls !== undefined) coachUpdate.gallery_urls = fields.galleryUrls;

    // Redesigned profile new fields
    if (fields.employeeId !== undefined) coachUpdate.employee_id = fields.employeeId;
    if (fields.designation !== undefined) coachUpdate.designation = fields.designation;
    if (fields.department !== undefined) coachUpdate.department = fields.department;
    if (fields.specialization !== undefined) coachUpdate.specialization = fields.specialization;
    if (fields.employeeType !== undefined) coachUpdate.employee_type = fields.employeeType;
    if (fields.workingDays !== undefined) coachUpdate.working_days = fields.workingDays;
    if (fields.gender !== undefined) coachUpdate.gender = fields.gender;
    if (fields.dateOfBirth !== undefined) coachUpdate.date_of_birth = fields.dateOfBirth || null;
    if (fields.address !== undefined) coachUpdate.address = fields.address;
    if (fields.emergencyContactName !== undefined) coachUpdate.emergency_contact_name = fields.emergencyContactName;
    if (fields.emergencyContactRelationship !== undefined) coachUpdate.emergency_contact_relationship = fields.emergencyContactRelationship;
    if (fields.emergencyContactPhone !== undefined) coachUpdate.emergency_contact_phone = fields.emergencyContactPhone;
    if (fields.emergencyContactAddress !== undefined) coachUpdate.emergency_contact_address = fields.emergencyContactAddress;

    if (Object.keys(coachUpdate).length > 0) {
      coachUpdate.updated_at = new Date().toISOString();
      const { error: coachErr } = await db
        .from('coaches')
        .update(coachUpdate)
        .eq('id', coachId);
      if (coachErr) throw coachErr;
    }

    // Update financial fields (Admin or Self)
    if (hasRole(ctx, 'admin', 'superadmin') || coachId === ctx.userId) {
      const finUpdate: Record<string, any> = {};
      if (fields.salaryType !== undefined) finUpdate.salary_type = fields.salaryType;
      if (fields.fixedSalary !== undefined) finUpdate.fixed_salary = Number(fields.fixedSalary);
      if (fields.perClassRate !== undefined) finUpdate.per_class_rate = Number(fields.perClassRate);
      if (fields.revenueSharePct !== undefined) finUpdate.revenue_share_pct = Number(fields.revenueSharePct);
      if (fields.bankAccountNumber !== undefined) finUpdate.bank_account_number = fields.bankAccountNumber;
      if (fields.bankIfscCode !== undefined) finUpdate.bank_ifsc_code = fields.bankIfscCode;
      if (fields.bankName !== undefined) finUpdate.bank_name = fields.bankName;
      if (fields.upiId !== undefined) finUpdate.upi_id = fields.upiId;
      if (fields.panNumber !== undefined) finUpdate.pan_number = fields.panNumber;
      if (fields.bankAccountHolderName !== undefined) finUpdate.bank_account_holder_name = fields.bankAccountHolderName;

      if (Object.keys(finUpdate).length > 0) {
        finUpdate.updated_at = new Date().toISOString();
        const { error: finErr } = await db
          .from('coach_financial_settings')
          .update(finUpdate)
          .eq('coach_id', coachId);
        if (finErr) throw finErr;
      }
    }

    // Optionally update user fields
    const userUpdate: Record<string, any> = {};
    if (hasRole(ctx, 'admin', 'superadmin')) {
      if (fields.firstName !== undefined) userUpdate.first_name = fields.firstName;
      if (fields.lastName !== undefined) userUpdate.last_name = fields.lastName;
    }
    if (fields.phone !== undefined) userUpdate.phone = fields.phone;
    if (fields.avatarUrl !== undefined) userUpdate.avatar_url = fields.avatarUrl;
    if (fields.alternatePhone !== undefined) userUpdate.alternate_phone = fields.alternatePhone;
    if (fields.notificationPreferences !== undefined) userUpdate.notification_preferences = fields.notificationPreferences;

    if (Object.keys(userUpdate).length > 0) {
      const { error: userErr } = await db
        .from('users')
        .update(userUpdate)
        .eq('id', coachId);
      if (userErr) throw userErr;
    }

    return ok({ success: true });
  } catch (e: unknown) {
    console.error('[API PUT /coaches] Error detail:', e);
    const errorMsg = e instanceof Error 
      ? e.message 
      : (typeof e === 'object' && e !== null && 'message' in e 
          ? (e as any).message 
          : String(e));
    return err(errorMsg, 500);
  }
}
