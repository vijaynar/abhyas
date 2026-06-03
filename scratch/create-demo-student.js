const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabaseUrl = 'https://dcdnfqxvksjznfyktqhg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZG5mcXh2a3Nqem5meWt0cWhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQzNzM0NCwiZXhwIjoyMDk1MDEzMzQ0fQ.UjCN_loCKhNtn0dCPJSXCvmeQ3UAXr7bIchKdH2eWBs';
const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const email = 'demo-student@upasthiti.com';
  const password = 'password123';
  const tenantId = '022c1494-057e-4c80-80dd-88fa4b1287b5'; // VidyaSopan Sports school

  console.log('Checking if demo-student exists in Supabase Auth...');
  
  // 1. Create or get user in Supabase Auth
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    return;
  }

  let demoUser = usersData.users.find(u => u.email === email);
  let userId;

  if (!demoUser) {
    console.log('Creating demo user in Supabase Auth...');
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'student',
        tenant_id: tenantId
      },
      user_metadata: {
        first_name: 'Demo',
        last_name: 'Student'
      }
    });

    if (createError) {
      console.error('Failed to create auth user:', createError.message);
      return;
    }

    userId = createData.user.id;
    console.log('Auth user created successfully! ID:', userId);
  } else {
    userId = demoUser.id;
    console.log('Demo user already exists in auth. ID:', userId);
  }

  // 2. Sync public tables (using direct PG database to ensure consistency)
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB via PG to verify public tables sync...');

    const userRes = await client.query('SELECT role FROM public.users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      console.log('Inserting into public.users table...');
      await client.query(`
        INSERT INTO public.users (id, tenant_id, email, role, first_name, last_name, phone, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'student', 'Demo', 'Student', null, true, now(), now())
      `, [userId, tenantId, email]);
    } else {
      console.log('User profile already exists in public.users.');
    }

    const studentRes = await client.query('SELECT id FROM public.students WHERE id = $1', [userId]);
    if (studentRes.rows.length === 0) {
      console.log('Inserting into public.students table...');
      await client.query(`
        INSERT INTO public.students (id, tenant_id, student_custom_id, date_of_birth, joining_date, status, created_at, updated_at)
        VALUES ($1, $2, 'vs-demo', '2005-01-01'::date, CURRENT_DATE, 'active', now(), now())
      `, [userId, tenantId]);
      console.log('Demo student profile verified and synchronized successfully!');
    } else {
      console.log('Student profile already exists in public.students.');
    }
  } catch (dbErr) {
    console.error('DB Sync Error:', dbErr.message);
  } finally {
    await client.end();
  }
}

main();
