// apps/web/src/app/api/v1/admin/sync-coach-status/route.ts
// POST /api/v1/admin/sync-coach-status
// Admin-only: syncs all coaches' account_status based on the lifecycle rules.

import { getAuthContext, adminDb, ok, err, hasRole } from '@/lib/api';

/**
 * Status sync logic:
 *  - is_active = true  →  'Active'
 *  - is_active = false + already 'Inactive' (deactivated by admin)  →  keep 'Inactive'
 *  - is_active = false + has Government ID AND Certification docs  →  'Pending Verification'
 *  - is_active = false + has some docs but missing mandatory  →  'Document Upload Pending'
 *  - is_active = false + no docs at all  →  'Onboarding'
 *
 * Mandatory doc types (mapped at upload time):
 *   'Aadhaar Card' / 'PAN Card' → document_type = 'Government ID'
 *   'Qualification Certificate' / 'NIS Certification' → document_type = 'Certification'
 */
export async function POST() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403);

    const db = adminDb();

    // 1. Fetch all coaches (users + coaches profile) for this tenant
    let usersQuery = db
      .from('users')
      .select('id, is_active, tenant_id, coach_profile:coaches(account_status)')
      .eq('role', 'coach');

    if (ctx.role !== 'superadmin') {
      usersQuery = usersQuery.eq('tenant_id', ctx.tenantId);
    }

    const { data: coachUsers, error: usersErr } = await usersQuery;
    if (usersErr) throw usersErr;
    if (!coachUsers || coachUsers.length === 0) {
      return ok({ synced: 0, changes: [], message: 'No coaches found.' });
    }

    // 2. Fetch all coach_documents for this tenant's coaches
    const coachIds = coachUsers.map((u: any) => u.id);
    const { data: allDocs, error: docsErr } = await db
      .from('coach_documents')
      .select('coach_id, document_type, document_name, verification_status')
      .in('coach_id', coachIds);
    if (docsErr) throw docsErr;

    // Group docs by coach_id
    const docsByCoach: Record<string, { document_type: string; document_name: string; verification_status: string }[]> = {};
    for (const doc of allDocs ?? []) {
      if (!docsByCoach[doc.coach_id]) docsByCoach[doc.coach_id] = [];
      docsByCoach[doc.coach_id].push(doc);
    }

    // 3. Determine correct status for each coach
    const changes: { coachId: string; from: string; to: string }[] = [];
    const updatePromises: Promise<void>[] = [];

    for (const coachUser of coachUsers) {
      const coachProfile = Array.isArray(coachUser.coach_profile)
        ? coachUser.coach_profile[0]
        : coachUser.coach_profile;

      if (!coachProfile) continue; // no coaches row — skip

      const currentStatus: string = coachProfile.account_status ?? 'Onboarding';
      let targetStatus: string;

      if (coachUser.is_active) {
        // Active in users table → mark Active
        targetStatus = 'Active';
      } else if (currentStatus === 'Inactive') {
        // Admin explicitly deactivated → keep Inactive
        targetStatus = 'Inactive';
      } else {
        // Determine based on uploaded documents
        const docs = docsByCoach[coachUser.id] ?? [];
        const hasGovtId = docs.some(d => d.document_type === 'Government ID');
        const hasCertification = docs.some(d => d.document_type === 'Certification');
        const hasDocs = docs.length > 0;

        if (hasGovtId && hasCertification) {
          targetStatus = 'Pending Verification';
        } else if (hasDocs) {
          targetStatus = 'Document Upload Pending';
        } else {
          targetStatus = 'Onboarding';
        }
      }

      if (targetStatus !== currentStatus) {
        changes.push({ coachId: coachUser.id, from: currentStatus, to: targetStatus });
        updatePromises.push(
          db
            .from('coaches')
            .update({ account_status: targetStatus })
            .eq('id', coachUser.id)
            .then(({ error }) => {
              if (error) throw error;
            })
        );
      }
    }

    // 4. Execute all updates
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    return ok({
      synced: changes.length,
      total: coachUsers.length,
      changes,
      message: changes.length === 0
        ? 'All coach statuses are already up to date.'
        : `Synced ${changes.length} of ${coachUsers.length} coaches.`,
    });
  } catch (e: unknown) {
    console.error('[sync-coach-status] Error:', e);
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
