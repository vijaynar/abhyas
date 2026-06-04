const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const rolesRes = await client.query(`
      SELECT id, name, is_system, tenant_id FROM public.roles;
    `);
    console.log('--- ALL ROLES ---');
    console.log(rolesRes.rows);

    const permRes = await client.query(`
      SELECT id, module, action FROM public.permissions;
    `);
    console.log('--- ALL PERMISSIONS ---');
    console.log(permRes.rows);

    const rolePermsRes = await client.query(`
      SELECT rp.role_id, r.name as role_name, p.module, p.action
      FROM public.role_permissions rp
      JOIN public.roles r ON rp.role_id = r.id
      JOIN public.permissions p ON rp.permission_id = p.id;
    `);
    console.log('--- ROLE PERMISSIONS MAPPING ---');
    console.log(rolePermsRes.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
