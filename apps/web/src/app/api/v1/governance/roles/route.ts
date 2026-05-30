// GET  /api/v1/governance/roles  — Fetch roles + permissions + matrix (Admin/Superadmin)
// POST /api/v1/governance/roles  — Create custom role
// PUT  /api/v1/governance/roles  — Update role permissions

import { getAuthContext, adminDb, ok, err, created, logAuditEvent } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!['admin', 'superadmin'].includes(ctx.role)) return err('Forbidden', 403);

    const db = adminDb();

    // Fetch all permissions
    const { data: permissions, error: permErr } = await db
      .from('permissions')
      .select('*')
      .order('module')
      .order('action');
    if (permErr) throw permErr;

    // Fetch roles scoped to this tenant + global system roles
    const { data: roles, error: rolesErr } = await db
      .from('roles')
      .select('*')
      .or(`tenant_id.eq.${ctx.tenantId},tenant_id.is.null`)
      .order('is_system', { ascending: false })
      .order('name');
    if (rolesErr) throw rolesErr;

    // Fetch role_permissions
    const { data: rolePerms, error: rpErr } = await db
      .from('role_permissions')
      .select('role_id, permission_id');
    if (rpErr) throw rpErr;

    // Count users per role
    let countQuery = db.from('users').select('role_id');
    if (ctx.role !== 'superadmin') {
      countQuery = countQuery.eq('tenant_id', ctx.tenantId);
    }
    const { data: userRoleCounts, error: ucErr } = await countQuery;
    if (ucErr) throw ucErr;

    const countMap: Record<string, number> = {};
    (userRoleCounts ?? []).forEach((u: any) => {
      if (u.role_id) countMap[u.role_id] = (countMap[u.role_id] ?? 0) + 1;
    });

    const enrichedRoles = (roles ?? []).map((r: any) => ({
      ...r,
      userCount: countMap[r.id] ?? 0,
    }));

    return ok({ permissions, roles: enrichedRoles, rolePermissions: rolePerms });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!['admin', 'superadmin'].includes(ctx.role)) return err('Forbidden', 403);

    const { name, assignedPermissions } = await req.json();
    if (!name || !Array.isArray(assignedPermissions)) {
      return err('name and assignedPermissions[] are required.', 422);
    }

    const db = adminDb();

    // Create the role scoped to this tenant
    const { data: role, error: roleErr } = await db
      .from('roles')
      .insert({ name, tenant_id: ctx.tenantId, is_system: false })
      .select()
      .single();
    if (roleErr) {
      if (roleErr.message.includes('unique')) return err('A role with this name already exists.', 409);
      throw roleErr;
    }

    if (assignedPermissions.length > 0) {
      // Resolve permission IDs from module.action strings
      const { data: perms, error: permErr } = await db
        .from('permissions')
        .select('id, module, action');
      if (permErr) throw permErr;

      const permMap: Record<string, string> = {};
      (perms ?? []).forEach((p: any) => { permMap[`${p.module}.${p.action}`] = p.id; });

      const mappings = assignedPermissions
        .filter((key: string) => permMap[key])
        .map((key: string) => ({ role_id: role.id, permission_id: permMap[key] }));

      if (mappings.length > 0) {
        const { error: rpErr } = await db.from('role_permissions').insert(mappings);
        if (rpErr) throw rpErr;
      }
    }

    await logAuditEvent(
      ctx.tenantId,
      ctx.userId,
      'roles.manage',
      `Created custom role "${name}"`
    );

    return created({ role });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!['admin', 'superadmin'].includes(ctx.role)) return err('Forbidden', 403);

    const { roleId, assignedPermissions } = await req.json();
    if (!roleId || !Array.isArray(assignedPermissions)) {
      return err('roleId and assignedPermissions[] are required.', 422);
    }

    const db = adminDb();

    // Verify role exists and is not locked out
    const { data: role, error: roleErr } = await db
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();
    if (roleErr || !role) return err('Role not found.', 404);
    if (role.name === 'Super Admin') return err('Super Admin permissions cannot be modified.', 403);

    // Resolve permission IDs
    const { data: perms, error: permErr } = await db
      .from('permissions')
      .select('id, module, action');
    if (permErr) throw permErr;

    const permMap: Record<string, string> = {};
    (perms ?? []).forEach((p: any) => { permMap[`${p.module}.${p.action}`] = p.id; });

    const newPermIds = assignedPermissions
      .filter((key: string) => permMap[key])
      .map((key: string) => permMap[key]);

    // Delete existing mappings, then insert new
    await db.from('role_permissions').delete().eq('role_id', roleId);

    if (newPermIds.length > 0) {
      const mappings = newPermIds.map((pid: string) => ({ role_id: roleId, permission_id: pid }));
      const { error: rpErr } = await db.from('role_permissions').insert(mappings);
      if (rpErr) throw rpErr;
    }

    await logAuditEvent(
      ctx.tenantId,
      ctx.userId,
      'roles.manage',
      `Updated permissions for role "${role.name}": [${assignedPermissions.join(', ')}]`
    );

    return ok({ roleId, updatedPermissions: assignedPermissions });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
