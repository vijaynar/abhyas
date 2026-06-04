import { getAuthContext, adminDb, ok, err } from '@/lib/api';

export async function PATCH(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);

    const body = await req.json();
    const { role } = body;

    if (!role) {
      return err('Role is required', 400);
    }

    const db = adminDb();

    // 1. Fetch user profile to verify available_roles
    const { data: profile, error: profileErr } = await db
      .from('users')
      .select('id, email, role, available_roles, tenant_id')
      .eq('id', ctx.userId)
      .single();

    if (profileErr || !profile) {
      return err('User profile not found', 404);
    }

    const availableRoles = profile.available_roles || [];
    const targetRoleLower = role.toLowerCase();

    // Check if the requested role is in available_roles
    if (!availableRoles.map((r: string) => r.toLowerCase()).includes(targetRoleLower)) {
      return err(`Requested role '${role}' is not in your available roles`, 403);
    }

    // 2. Map role name to DB roles.name
    let dbRoleName = '';
    switch (targetRoleLower) {
      case 'superadmin':
        dbRoleName = 'Super Admin';
        break;
      case 'admin':
        dbRoleName = 'Admin';
        break;
      case 'coach':
        dbRoleName = 'Coach';
        break;
      case 'student':
        dbRoleName = 'Student';
        break;
      case 'parent':
        dbRoleName = 'Parent';
        break;
      default:
        dbRoleName = role; // Custom tenant-defined role
    }

    // 3. Lookup the role ID
    const { data: roleRow, error: roleErr } = await db
      .from('roles')
      .select('id')
      .ilike('name', dbRoleName)
      .maybeSingle();

    if (roleErr || !roleRow) {
      return err(`Role '${dbRoleName}' not found in the roles database`, 404);
    }

    // 4. Update current active role and role_id in users
    const { error: updateErr } = await db
      .from('users')
      .update({
        role: targetRoleLower,
        role_id: roleRow.id
      })
      .eq('id', ctx.userId);

    if (updateErr) throw updateErr;

    // 5. Write an audit log entry
    await db.from('audit_logs').insert({
      tenant_id: profile.tenant_id,
      user_id: ctx.userId,
      action: 'switch_role',
      description: `User ${profile.email} switched active role from '${profile.role}' to '${targetRoleLower}'`
    });

    return ok({ success: true, activeRole: targetRoleLower });
  } catch (e: unknown) {
    console.error('[Switch Role API Error]:', e);
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
