const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Supabase DB!');
    
    const tenants = await client.query('SELECT id, name, slug FROM tenants');
    console.log('\n--- Tenants ---');
    console.log(tenants.rows);

    const rolesCount = await client.query('SELECT role, count(*) FROM users GROUP BY role');
    console.log('\n--- Roles Count in users Table ---');
    console.log(rolesCount.rows);

    const firstUser = await client.query('SELECT id, email, role, tenant_id, first_name, last_name FROM users LIMIT 5');
    console.log('\n--- Sample Users ---');
    console.log(firstUser.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
