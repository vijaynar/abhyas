const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log('Fetching role and permission IDs...');
    const roleRes = await client.query(`
      SELECT id FROM public.roles WHERE name = 'Admin' AND tenant_id IS NULL;
    `);
    const permRes = await client.query(`
      SELECT id FROM public.permissions WHERE module = 'portal' AND action = 'manage';
    `);

    if (roleRes.rows.length === 0) {
      throw new Error('System "Admin" role not found!');
    }
    if (permRes.rows.length === 0) {
      throw new Error('Permission "portal.manage" not found!');
    }

    const roleId = roleRes.rows[0].id;
    const permId = permRes.rows[0].id;

    console.log(`Mapping role Admin (${roleId}) to permission portal.manage (${permId})...`);

    const insertRes = await client.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING;
    `, [roleId, permId]);

    console.log('Successfully granted portal.manage to Admin role.', insertRes.rowCount);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
