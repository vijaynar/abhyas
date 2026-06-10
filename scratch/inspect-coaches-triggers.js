const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const triggers = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'coaches';
    `);
    console.log('--- TRIGGERS ON coaches TABLE ---');
    console.log(triggers.rows);

    const columns = await client.query(`
      SELECT column_name, column_default, data_type
      FROM information_schema.columns
      WHERE table_name = 'coaches';
    `);
    console.log('\n--- DEFAULTS ON coaches TABLE ---');
    console.table(columns.rows.map(r => ({ column_name: r.column_name, column_default: r.column_default, data_type: r.data_type })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
