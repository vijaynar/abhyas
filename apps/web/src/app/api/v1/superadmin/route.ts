// apps/web/src/app/api/v1/superadmin/route.ts
// Secure API endpoint for platform-wide SaaS administration.
// Only accessible by users with the 'superadmin' role.

import { getAuthContext, adminDb, ok, err, created } from '@/lib/api';

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

    // 4. Fetch linked tenant owner admin emails (includes superadmin users who own a tenant)
    const { data: admins, error: adminsErr } = await db
      .from('users')
      .select('tenant_id, email, first_name, last_name, phone, alternate_phone')
      .in('role', ['admin', 'superadmin']);

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

    return ok({
      stats: {
        totalTenants: totalTenants || 0,
        activeTenants: activeTenants || 0,
        suspendedTenants: suspendedTenants || 0,
        trialTenants: trialTenants || 0,
        avgAttendance
      },
      tenants: enrichedTenants || []
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

    // 2. Create the Admin user in Supabase Auth
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

    // 3. Insert user profile in public.users
    const { error: profileError } = await db
      .from('users')
      .insert({
        id: userId,
        tenant_id: tenant.id,
        email,
        role: 'admin',
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
