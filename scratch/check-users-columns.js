// scratch/check-users-columns.js
const { Client } = require('pg');
const connectionString = 'postgresql://postgres:AUv%23F%23%2CENt4s64%26@db.dcdnfqxvksjznfyktqhg.supabase.co:5432/postgres';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to PostgreSQL database successfully!\n');

  try {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    console.log('--- USERS TABLE COLUMNS ---');
    console.table(res.rows);
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

main();
