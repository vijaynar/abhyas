// Audit script: shows what status EACH inactive coach SHOULD have based on documents.
// Run with: node scripts/audit-coach-status.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dcdnfqxvksjznfyktqhg.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZG5mcXh2a3Nqem5meWt0cWhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQzNzM0NCwiZXhwIjoyMDk1MDEzMzQ0fQ.UjCN_loCKhNtn0dCPJSXCvmeQ3UAXr7bIchKdH2eWBs';

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  console.log('🔍 Fetching all coaches...\n');

  const { data: coachUsers, error: usersErr } = await db
    .from('users')
    .select('id, is_active, email, first_name, last_name, coach_profile:coaches(account_status)')
    .eq('role', 'coach');

  if (usersErr) { console.error('❌', usersErr.message); process.exit(1); }

  const coachIds = coachUsers.map((u) => u.id);
  const { data: allDocs, error: docsErr } = await db
    .from('coach_documents')
    .select('coach_id, document_type, document_name, verification_status')
    .in('coach_id', coachIds);

  if (docsErr) { console.error('❌', docsErr.message); process.exit(1); }

  // Group docs by coach_id
  const docsByCoach = {};
  for (const doc of allDocs ?? []) {
    if (!docsByCoach[doc.coach_id]) docsByCoach[doc.coach_id] = [];
    docsByCoach[doc.coach_id].push(doc);
  }

  console.log('Coach Status Audit Report');
  console.log('═'.repeat(80));

  for (const coachUser of coachUsers) {
    const coachProfile = Array.isArray(coachUser.coach_profile)
      ? coachUser.coach_profile[0]
      : coachUser.coach_profile;

    const currentStatus = coachProfile?.account_status ?? 'N/A';
    const docs = docsByCoach[coachUser.id] ?? [];
    const hasGovtId = docs.some((d) => d.document_type === 'Government ID');
    const hasCertification = docs.some((d) => d.document_type === 'Certification');
    const hasResume = docs.some((d) => d.document_type === 'Resume');

    // Compute what status should be (ignoring the old "preserve Inactive" rule)
    let correctStatus;
    if (coachUser.is_active) {
      correctStatus = 'Active';
    } else if (hasGovtId && hasCertification) {
      correctStatus = 'Pending Verification';
    } else if (docs.length > 0) {
      correctStatus = 'Document Upload Pending';
    } else {
      correctStatus = 'Onboarding';
    }

    const statusMatch = currentStatus === correctStatus;
    const icon = coachUser.is_active ? '🟢' : statusMatch ? '✅' : '⚠️ ';

    console.log(`${icon} ${coachUser.first_name} ${coachUser.last_name} (${coachUser.email})`);
    console.log(`   is_active     : ${coachUser.is_active}`);
    console.log(`   current status: ${currentStatus}`);
    console.log(`   correct status: ${correctStatus}${statusMatch ? ' (matches)' : ' ← NEEDS UPDATE'}`);
    console.log(`   docs uploaded : ${docs.length === 0 ? 'none' : docs.map(d => `${d.document_name} [${d.document_type}/${d.verification_status}]`).join(', ')}`);
    console.log(`   has GovtId    : ${hasGovtId} | has Certification: ${hasCertification} | has Resume: ${hasResume}`);
    console.log('─'.repeat(80));
  }
}

run();
