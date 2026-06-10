const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const fnEnrich = await client.query(`
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'enrich_auth_user_metadata';
    `);
    console.log('--- enrich_auth_user_metadata ---');
    console.log(fnEnrich.rows[0]?.def);

    const fnSync = await client.query(`
      SELECT pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = 'sync_auth_user_profile';
    `);
    console.log('\n--- sync_auth_user_profile ---');
    console.log(fnSync.rows[0]?.def);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
