// scratch/test-endpoint.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually parse env file
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const index = trimmed.indexOf('=');
  if (index === -1) return;
  const key = trimmed.substring(0, index).trim();
  const val = trimmed.substring(index + 1).trim();
  env[key] = val;
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase env vars in apps/web/.env.local');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testMatchGroup() {
  console.log('Testing /api/v1/attendance/match-group logic...');
  
  // 1. Get a batch
  const { data: batches, error: batchErr } = await db
    .from('batches')
    .select('id, tenant_id, name, start_time')
    .eq('is_active', true);

  if (batchErr || !batches || batches.length === 0) {
    console.error('No batches found:', batchErr);
    return;
  }

  for (const batch of batches) {
    console.log('\nSelected batch:', batch.name, 'ID:', batch.id);

    // 2. Enrolled students
    const { data: enrolledStudents, error: enrollErr } = await db
      .from('students')
      .select('id, student_custom_id, users!inner(first_name, last_name, email)')
      .eq('batch_id', batch.id);

    if (enrollErr) {
      console.error('Enrolled students fetch error:', enrollErr);
      continue;
    }

    console.log('Enrolled students count:', enrolledStudents.length);
    if (enrolledStudents.length > 0) {
      console.table(enrolledStudents.map(s => ({
        id: s.id,
        custom_id: s.student_custom_id,
        name: `${s.users.first_name} ${s.users.last_name}`
      })));
    }

    // 3. Let's mock a face embedding (128-float unit vector)
    const raw = Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    const magnitude = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
    const mockEmbedding = raw.map((v) => v / magnitude);

    // 4. Run the match rpc
    const embeddingLiteral = `[${mockEmbedding.join(',')}]`;
    console.log('Calling match_face_embedding RPC...');
    const { data: matches, error: matchErr } = await db.rpc(
      'match_face_embedding',
      {
        p_tenant_id: batch.tenant_id,
        input_embedding: embeddingLiteral,
        match_threshold: 0.60,
        match_count: 1,
      }
    );

    if (matchErr) {
      console.error('RPC Error:', matchErr);
      continue;
    }

    console.log('RPC Matches:', matches);

    // 5. Simulate the route return values
    let unrecognizedCount = 0;
    if (!matches || matches.length === 0) {
      unrecognizedCount++;
    }

    console.log('Resulting unrecognizedCount:', unrecognizedCount);
  }
}

testMatchGroup();
