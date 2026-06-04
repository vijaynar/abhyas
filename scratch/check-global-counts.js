const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const tenantsCount = await client.query('SELECT COUNT(*) FROM public.tenants;');
    const studentsCount = await client.query('SELECT COUNT(*) FROM public.students;');
    const coachesCount = await client.query('SELECT COUNT(*) FROM public.coaches;');
    const usersCount = await client.query('SELECT COUNT(*) FROM public.users;');
    const adminsCount = await client.query("SELECT COUNT(*) FROM public.users WHERE role = 'admin' OR role = 'superadmin';");
    const batchesCount = await client.query('SELECT COUNT(*) FROM public.batches;');
    const classesCount = await client.query('SELECT COUNT(*) FROM public.classes;');
    const attendanceLogsCount = await client.query('SELECT COUNT(*) FROM public.attendance_logs;');
    const finesCount = await client.query("SELECT SUM(amount) as total FROM public.fines WHERE status != 'paid' AND status != 'waived';");

    console.log('--- ACTUAL DB COUNTS ---');
    console.log('Academies:', tenantsCount.rows[0].count);
    console.log('Students:', studentsCount.rows[0].count);
    console.log('Coaches:', coachesCount.rows[0].count);
    console.log('Users Total:', usersCount.rows[0].count);
    console.log('Admins Total:', adminsCount.rows[0].count);
    console.log('Batches:', batchesCount.rows[0].count);
    console.log('Classes:', classesCount.rows[0].count);
    console.log('Attendance Logs:', attendanceLogsCount.rows[0].count);
    console.log('Fines Pending Sum:', finesCount.rows[0].total || 0);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
