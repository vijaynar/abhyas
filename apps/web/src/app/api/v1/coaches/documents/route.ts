// apps/web/src/app/api/v1/coaches/documents/route.ts
// GET  /api/v1/coaches/documents?coachId=...   — list all documents for a coach
// POST /api/v1/coaches/documents               — link uploaded document to a coach
// PUT  /api/v1/coaches/documents               — verify or reject a document (admin only)

import { getAuthContext, adminDb, ok, created, err, hasRole } from '@/lib/api';

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const { searchParams } = new URL(req.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) return err('coachId is required', 422);

    // Coaches can only view their own documents; admins can view anyone
    if (ctx.role === 'coach' && coachId !== ctx.userId) {
      return err('Forbidden: coaches can only view their own documents', 403);
    }

    const db = adminDb();
    const { data: docs, error } = await db
      .from('coach_documents')
      .select('*')
      .eq('coach_id', coachId)
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return ok(docs);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin', 'coach')) return err('Forbidden', 403);

    const body = await req.json();
    const { coachId, documentType, documentName, fileUrl, expiryDate } = body;

    if (!coachId || !documentType || !documentName || !fileUrl) {
      return err('coachId, documentType, documentName, and fileUrl are required', 422);
    }

    // Coaches can only upload their own documents; admins can upload for anyone
    if (ctx.role === 'coach' && coachId !== ctx.userId) {
      return err('Forbidden: coaches can only upload their own documents', 403);
    }

    const db = adminDb();
    const { data: doc, error } = await db
      .from('coach_documents')
      .insert({
        coach_id: coachId,
        tenant_id: ctx.tenantId,
        document_type: documentType,
        document_name: documentName,
        file_url: fileUrl,
        expiry_date: expiryDate ? new Date(expiryDate).toISOString().split('T')[0] : null,
        verification_status: 'Pending',
      })
      .select()
      .single();

    if (error) throw error;
    return created(doc);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await getAuthContext();
    if (!ctx) return err('Unauthorised', 401);
    if (!hasRole(ctx, 'admin', 'superadmin')) return err('Forbidden', 403); // Admin only verification

    const body = await req.json();
    const { documentId, status, rejectionReason } = body;

    if (!documentId || !status) {
      return err('documentId and status are required', 422);
    }

    if (!['Verified', 'Rejected'].includes(status)) {
      return err('Status must be Verified or Rejected', 422);
    }

    const db = adminDb();
    const { data: doc, error } = await db
      .from('coach_documents')
      .update({
        verification_status: status,
        rejection_reason: status === 'Rejected' ? (rejectionReason ?? null) : null,
        verified_by: ctx.userId,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('tenant_id', ctx.tenantId)
      .select()
      .single();

    if (error) throw error;
    return ok(doc);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
