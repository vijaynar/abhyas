const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    // Check RLS status
    const rls = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('coaches', 'coach_financial_settings', 'users');
    `);
    console.log('--- RLS Status ---');
    console.log(JSON.stringify(rls.rows, null, 2));

    // Check policies
    const policies = await client.query(`
      SELECT tablename, policyname, cmd, roles, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('coaches', 'coach_financial_settings', 'users');
    `);
    console.log('\n--- Policies ---');
    console.log(JSON.stringify(policies.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
