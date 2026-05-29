// scratch/run-migration-client-email.js
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  console.log('Connecting to Supabase PostgreSQL database...');
  await client.connect();
  console.log('Connected successfully!');

  try {
    console.log('Executing migration query to add email column to tenants table...');
    await client.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email VARCHAR(255);');
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error executing migration:', err.message);
  } finally {
    await client.end();
  }
}

main();
