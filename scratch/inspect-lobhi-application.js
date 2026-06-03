const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log('Searching for users matching Lobhi Track or vs-10072df4...');
    
    // Find the user profile matching the roll number or name
    const userRes = await client.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.tenant_id, t.name as tenant_name
      FROM public.users u
      LEFT JOIN public.tenants t ON u.tenant_id = t.id
      WHERE u.first_name ILIKE '%Lobhi%' OR u.last_name ILIKE '%Lobhi%'
         OR u.id IN (SELECT id FROM public.students WHERE student_custom_id = 'vs-10072df4');
    `);
    console.log('--- Matching Users ---');
    console.log(userRes.rows);

    if (userRes.rows.length > 0) {
      const targetUserId = userRes.rows[0].id;
      
      // Check the coaches table
      const coachRes = await client.query(`
        SELECT id, tenant_id, primary_skill, employment_status, public_profile_slug, created_at
        FROM public.coaches
        WHERE id = $1;
      `, [targetUserId]);
      console.log('--- Matching Coach Profile ---');
      console.log(coachRes.rows);

      // Check the coach_documents table
      const docRes = await client.query(`
        SELECT id, coach_id, tenant_id, document_type, document_name, verification_status
        FROM public.coach_documents
        WHERE coach_id = $1;
      `, [targetUserId]);
      console.log('--- Matching Coach Documents ---');
      console.log(docRes.rows);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
