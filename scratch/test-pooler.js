// scratch/test-pooler.js
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  console.log('Connecting to pooler in ap-northeast-2...');
  try {
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT now()');
    console.log('Time:', res.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

main();
