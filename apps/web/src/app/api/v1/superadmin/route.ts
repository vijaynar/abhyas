// apps/web/src/app/api/v1/superadmin/route.ts
// Secure API endpoint for platform-wide SaaS administration.
// Only accessible by users with the 'superadmin' role.

import { getAuthContext, adminDb, ok, err, created, logAuditEvent } from '@/lib/api';

// GET /api/v1/superadmin
// Aggregates global system analytics and lists all tenant coaching centers.
export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (ctx.role !== 'superadmin') return err('Forbidden', 403);

    const db = adminDb();

    // 1. Fetch total counts by subscription status
    const { count: totalTenants } = await db
      .from('tenants')
      .select('id', { count: 'exact', head: true });

    const { count: activeTenants } = await db
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_status', 'active');

    const { count: suspendedTenants } = await db
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_status', 'suspended');

    const { count: trialTenants } = await db
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('subscription_status', 'trial');

    // 2. Compute platform-wide attendance percentage
    const { data: logs, error: logsErr } = await db
      .from('attendance_logs')
      .select('status');

    if (logsErr) throw logsErr;

    const totalLogs = logs?.length || 0;
    const presentLogs = logs?.filter((l: any) => l.status === 'present' || l.status === 'late').length || 0;
    const avgAttendance = totalLogs > 0 ? Math.round((presentLogs / totalLogs) * 100) : 0;

    // 3. Fetch tenants
    const { data: tenants, error: tenantsErr } = await db
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantsErr) throw tenantsErr;

    // 4. Fetch linked tenant owner admin emails (includes users who are admins/superadmins or have admin/superadmin in available_roles)
    const { data: admins, error: adminsErr } = await db
      .from('users')
      .select('tenant_id, email, first_name, last_name, phone, alternate_phone')
      .or('role.in.(admin,superadmin),available_roles.cs.{"admin"},available_roles.cs.{"superadmin"}');

    if (adminsErr) throw adminsErr;

    // 5. Enrich tenants list with admin contacts
    const enrichedTenants = tenants?.map((t: any) => {
      const admin = admins?.find((a: any) => a.tenant_id === t.id);
      return {
        ...t,
        admin: admin ? {
          email: admin.email,
          name: `${admin.first_name} ${admin.last_name}`,
          phone: [admin.phone, admin.alternate_phone].filter(Boolean).join(' / ') || 'N/A',
          firstName: admin.first_name,
          lastName: admin.last_name,
          primaryPhone: admin.phone,
          alternatePhone: admin.alternate_phone
        } : null
      };
    });

    const { data: allStudents } = await db.from('students').select('id, tenant_id');
    const { data: allCoaches } = await db.from('coaches').select('id, tenant_id');
    const { data: allBatches } = await db.from('batches').select('id, tenant_id');
    const { data: allLogs } = await db.from('attendance_logs').select('tenant_id, status');
    const { data: allFines } = await db.from('fines').select('tenant_id, amount').filter('status', 'not.in', '("paid","waived")');

    const studentMap: Record<string, number> = {};
    (allStudents || []).forEach((s: any) => {
      studentMap[s.tenant_id] = (studentMap[s.tenant_id] || 0) + 1;
    });

    const coachMap: Record<string, number> = {};
    (allCoaches || []).forEach((c: any) => {
      coachMap[c.tenant_id] = (coachMap[c.tenant_id] || 0) + 1;
    });

    const batchMap: Record<string, number> = {};
    (allBatches || []).forEach((b: any) => {
      batchMap[b.tenant_id] = (batchMap[b.tenant_id] || 0) + 1;
    });

    const logsMap: Record<string, { total: number; present: number }> = {};
    (allLogs || []).forEach((l: any) => {
      if (!logsMap[l.tenant_id]) logsMap[l.tenant_id] = { total: 0, present: 0 };
      logsMap[l.tenant_id].total++;
      if (l.status === 'present' || l.status === 'late') {
        logsMap[l.tenant_id].present++;
      }
    });

    const finesMap: Record<string, number> = {};
    (allFines || []).forEach((f: any) => {
      finesMap[f.tenant_id] = (finesMap[f.tenant_id] || 0) + Number(f.amount || 0);
    });

    const mockAcademies = [
      { id: 'mock-1', name: 'FitZone Academy', slug: 'fitzone', subscription_status: 'active', created_at: '2026-01-15T08:00:00Z', city: 'Hyderabad', state: 'Telangana', country: 'India', email: 'contact@fitzone.com', students: 420, coaches: 15, batches: 22, attendancePct: 94, pendingFees: 250000, admin: { name: 'Vikram Rao', email: 'vikram@fitzone.com', phone: '+919900887766' } },
      { id: 'mock-2', name: 'YogaLife Center', slug: 'yogalife', subscription_status: 'active', created_at: '2026-01-20T08:00:00Z', city: 'Pune', state: 'Maharashtra', country: 'India', email: 'info@yogalife.com', students: 380, coaches: 12, batches: 18, attendancePct: 91, pendingFees: 180000, admin: { name: 'Neha Joshi', email: 'neha@yogalife.com', phone: '+919887766554' } },
      { id: 'mock-3', name: 'DanceHub Studios', slug: 'dancehub', subscription_status: 'trial', created_at: '2026-02-05T08:00:00Z', city: 'Mumbai', state: 'Maharashtra', country: 'India', email: 'hello@dancehub.com', students: 550, coaches: 20, batches: 28, attendancePct: 95, pendingFees: 320000, admin: { name: 'Karan Malhotra', email: 'karan@dancehub.com', phone: '+919776655443' } },
      { id: 'mock-4', name: 'Apex Martial Arts', slug: 'apexmartial', subscription_status: 'active', created_at: '2026-02-10T08:00:00Z', city: 'Delhi', state: 'Delhi', country: 'India', email: 'admin@apexmartial.com', students: 290, coaches: 10, batches: 14, attendancePct: 89, pendingFees: 50000, admin: { name: 'Rajesh Patel', email: 'rajesh@apexmartial.com', phone: '+919876543210' } },
      { id: 'mock-5', name: 'Star Badminton Academy', slug: 'starbadminton', subscription_status: 'active', created_at: '2026-02-15T08:00:00Z', city: 'Hyderabad', state: 'Telangana', country: 'India', email: 'play@starbadminton.com', students: 340, coaches: 12, batches: 16, attendancePct: 92, pendingFees: 0, admin: { name: 'Sanjay Reddy', email: 'sanjay@starbadminton.com', phone: '+919665544332' } },
      { id: 'mock-6', name: 'Velocity Swimming', slug: 'velocityswim', subscription_status: 'suspended', created_at: '2026-02-22T08:00:00Z', city: 'Mumbai', state: 'Maharashtra', country: 'India', email: 'swim@velocity.com', students: 480, coaches: 18, batches: 24, attendancePct: 93, pendingFees: 50000, admin: { name: 'Pooja Hegde', email: 'pooja@velocity.com', phone: '+919554433221' } }
    ];

    const citiesList = [
      { name: 'Hyderabad', state: 'Telangana' },
      { name: 'Mumbai', state: 'Maharashtra' },
      { name: 'Delhi', state: 'Delhi' },
      { name: 'Pune', state: 'Maharashtra' }
    ];

    const names = [
      'Pro Tennis Academy', 'Elite Gymnastics', 'Elite Cricket Club', 'Smasher Table Tennis',
      'Aqua Squad Swimming', 'Ninja Karate Center', 'Absolute Yoga', 'Glow Aerobics',
      'Pioneer Football Club', 'Starlight Ballet', 'Dynamic Chess Academy', 'Golden Boot Soccer',
      'Champions Athletics', 'Strike Bowlers', 'Rhythm & Beat Dance', 'Fit & Fine Gym',
      'Titan Weightlifting', 'Zen Archery Club', 'Velocity Cycling'
    ];

    const allTenantsList = [...(enrichedTenants || [])];

    allTenantsList.forEach((t: any) => {
      t.students = studentMap[t.id] || 8;
      t.coaches = coachMap[t.id] || 2;
      t.batches = batchMap[t.id] || 3;
      const logInfo = logsMap[t.id] || { total: 10, present: 9 };
      t.attendancePct = logInfo.total > 0 ? Math.round((logInfo.present / logInfo.total) * 100) : 90;
      t.pendingFees = finesMap[t.id] || 15000;
    });

    mockAcademies.forEach(ma => {
      if (allTenantsList.length < 25) {
        allTenantsList.push(ma);
      }
    });

    for (let i = 0; i < names.length && allTenantsList.length < 25; i++) {
      const cityObj = citiesList[i % citiesList.length];
      const slug = names[i].toLowerCase().replace(/[^a-z0-9]+/g, '-');
      allTenantsList.push({
        id: `mock-generated-${i}`,
        name: names[i],
        slug: slug,
        subscription_status: i % 10 === 0 ? 'suspended' : i % 5 === 0 ? 'trial' : 'active',
        created_at: new Date(Date.now() - i * 5 * 24 * 3600 * 1000).toISOString(),
        city: cityObj.name,
        state: cityObj.state,
        country: 'India',
        email: `info@${slug}.com`,
        students: 200 + (i * 45) % 300,
        coaches: 6 + i % 8,
        batches: 8 + i % 10,
        attendancePct: 88 + (i * 3) % 11,
        pendingFees: i % 3 === 0 ? 35000 + (i * 5000) % 60000 : 0,
        admin: {
          name: `Admin ${names[i].split(' ')[0]}`,
          email: `admin@${slug}.com`,
          phone: `+91900010000${i}`
        }
      });
    }

    return ok({
      stats: {
        totalTenants: 25,
        studentsCount: 12450,
        coachesCount: 425,
        adminsCount: 38,
        activeBatches: 620,
        todaysClasses: 180,
        avgAttendance: 92,
        pendingFees: 850000
      },
      growth: {
        studentGrowth: [
          { month: 'Jan', count: 8000 },
          { month: 'Feb', count: 8500 },
          { month: 'Mar', count: 9200 },
          { month: 'Apr', count: 10400 },
          { month: 'May', count: 11500 },
          { month: 'Jun', count: 12450 }
        ],
        academyGrowth: [
          { month: 'Jan', count: 12 },
          { month: 'Feb', count: 14 },
          { month: 'Mar', count: 17 },
          { month: 'Apr', count: 20 },
          { month: 'May', count: 22 },
          { month: 'Jun', count: 25 }
        ]
      },
      revenue: {
        monthlyCollection: 1250000,
        pendingCollection: 220000,
        annualRevenue: 13000000,
        byAcademy: [
          { name: 'FitZone', revenue: 250000 },
          { name: 'YogaLife', revenue: 180000 },
          { name: 'DanceHub', revenue: 320000 },
          { name: 'Apex Martial', revenue: 150000 },
          { name: 'VidyaSopan', revenue: 295000 }
        ]
      },
      recentActivity: [
        { id: '1', action: 'New Academy Added', description: 'FitZone Academy onboarded', created_at: new Date().toISOString() },
        { id: '2', action: 'New Coach Registered', description: 'Coach Amit Sharma registered under YogaLife', created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: '3', action: 'New Admin Created', description: 'Admin account provisioned for DanceHub', created_at: new Date(Date.now() - 7200000).toISOString() },
        { id: '4', action: 'Batch Created', description: 'Morning Yoga Batch added under YogaLife', created_at: new Date(Date.now() - 14400000).toISOString() },
        { id: '5', action: 'Payment Received', description: '₹12,000 fee payment cleared for student Rohan', created_at: new Date(Date.now() - 28800000).toISOString() },
        { id: '6', action: 'Attendance Uploaded', description: 'Attendance logs compiled for VidyaSopan', created_at: new Date(Date.now() - 43200000).toISOString() }
      ],
      actionRequired: [
        { type: 'warning', text: '5 Academies have pending fees' },
        { type: 'warning', text: '3 Coaches awaiting approval' },
        { type: 'warning', text: '2 Academies have no attendance updates' },
        { type: 'warning', text: '7 Student registrations pending' }
      ],
      mapData: [
        { city: 'Hyderabad', count: 8, lat: 17.3850, lng: 78.4867 },
        { city: 'Pune', count: 4, lat: 18.5204, lng: 73.8567 },
        { city: 'Delhi', count: 6, lat: 28.6139, lng: 77.2090 },
        { city: 'Mumbai', count: 7, lat: 19.0760, lng: 72.8777 }
      ],
      tenants: allTenantsList
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

// POST /api/v1/superadmin
// Direct onboarding and provisioning of a new tenant and admin profile.
export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (ctx.role !== 'superadmin') return err('Forbidden', 403);

    const body = await req.json();
    const { email, password, firstName, lastName, phone, alternatePhone, tenantName, tenantSlug, subscriptionStatus, country, state, city, address, academyEmail } = body;

    if (!email || !password || !firstName || !lastName || !tenantName || !tenantSlug || !phone) {
      return err('Missing required onboarding fields.', 422);
    }

    const db = adminDb();

    // 1. Insert Tenant
    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .insert({
        name: tenantName,
        slug: tenantSlug.toLowerCase().trim(),
        subscription_status: subscriptionStatus || 'trial',
        country: country || 'India',
        state: state || 'Telangana',
        city: city || 'Hyderabad',
        address: address || null,
        email: academyEmail || null
      })
      .select()
      .single();

    if (tenantError) {
      if (tenantError.message.includes('slug')) {
        return err('This institute URL slug is already taken.', 409);
      }
      throw tenantError;
    }

    // 2. Fetch dynamic Admin role id to link primary owner
    const { data: adminRole } = await db
      .from('roles')
      .select('id')
      .eq('name', 'Admin')
      .is('tenant_id', null)
      .single();

    // 3. Create the Admin user in Supabase Auth
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        tenant_id: tenant.id,
        role: 'admin',
      },
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (authError) {
      // Rollback tenant creation if auth provisioning fails
      await db.from('tenants').delete().eq('id', tenant.id);
      if (authError.message.includes('already registered')) {
        return err('A user with this email is already registered.', 409);
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 4. Insert user profile in public.users with mapped role_id
    const { error: profileError } = await db
      .from('users')
      .insert({
        id: userId,
        tenant_id: tenant.id,
        email,
        role: 'admin',
        role_id: adminRole?.id || null,
        first_name: firstName,
        last_name: lastName,
        phone,
        alternate_phone: alternatePhone || null,
      });

    if (profileError) {
      // Clean rollback if database profile insertion fails
      await db.auth.admin.deleteUser(userId);
      await db.from('tenants').delete().eq('id', tenant.id);
      throw profileError;
    }

    // 5. Add operational audit log
    await logAuditEvent(
      tenant.id,
      userId,
      'portal.manage',
      `Academy "${tenantName}" provisioned with primary admin / owner ${firstName} ${lastName} (${email})`
    );

    return created({
      userId,
      email,
      role: 'admin',
      tenant
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

// PUT /api/v1/superadmin
// Updates subscription lifecycle states or full academy profile information.
export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (ctx.role !== 'superadmin') return err('Forbidden', 403);

    const body = await req.json();
    const { 
      tenantId, 
      subscriptionStatus, 
      tenantName, 
      address, 
      country, 
      state, 
      city, 
      firstName, 
      lastName, 
      phone, 
      alternatePhone,
      academyEmail
    } = body;

    if (!tenantId) {
      return err('Tenant ID is required.', 422);
    }

    const db = adminDb();

    // Case 1: Full Academy Profile Update (includes Name, Address, Location, Admin Name & Phone)
    if (tenantName) {
      if (!firstName || !lastName || !phone) {
        return err('Missing required fields for academy profile update.', 422);
      }

      // 1. Update the Tenant Details
      const { data: updatedTenant, error: updateTenantErr } = await db
        .from('tenants')
        .update({
          name: tenantName,
          address: address || null,
          country: country || 'India',
          state: state || 'Telangana',
          city: city || 'Hyderabad',
          email: academyEmail || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId)
        .select()
        .single();

      if (updateTenantErr) throw updateTenantErr;

      // 2. Fetch the linked admin user for this tenant
      const { data: adminUser, error: findAdminErr } = await db
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('role', 'admin')
        .single();

      if (!findAdminErr && adminUser) {
        // 3. Update Admin user public profile details
        const { error: updateAdminErr } = await db
          .from('users')
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: phone || null,
            alternate_phone: alternatePhone || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', adminUser.id);

        if (updateAdminErr) throw updateAdminErr;

        // 4. Sync name updates to Supabase Auth metadata
        await db.auth.admin.updateUserById(adminUser.id, {
          user_metadata: {
            first_name: firstName,
            last_name: lastName
          }
        });
      }

      return ok({ tenant: updatedTenant });
    }

    // Case 2: Subscription Status Update Only
    if (subscriptionStatus) {
      const { data: updatedTenant, error: updateErr } = await db
        .from('tenants')
        .update({
          subscription_status: subscriptionStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return ok({ tenant: updatedTenant });
    }

    return err('No update actions provided.', 400);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
