const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const res = await client.query(`
      SELECT u.id, u.email, u.role, u.tenant_id, t.name as tenant_name
      FROM public.users u
      LEFT JOIN public.tenants t ON u.tenant_id = t.id
      WHERE u.email = 'narayanvijay77@gmail.com';
    `);
    console.log('--- USER PROFILE FOR narayanvijay77@gmail.com ---');
    console.log(res.rows);

    const authRes = await client.query(`
      SELECT id, email, raw_app_meta_data, raw_user_meta_data
      FROM auth.users
      WHERE email = 'narayanvijay77@gmail.com';
    `);
    console.log('--- AUTH USER FOR narayanvijay77@gmail.com ---');
    console.log(authRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
