const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabaseUrl = 'https://dcdnfqxvksjznfyktqhg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjZG5mcXh2a3Nqem5meWt0cWhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQzNzM0NCwiZXhwIjoyMDk1MDEzMzQ0fQ.UjCN_loCKhNtn0dCPJSXCvmeQ3UAXr7bIchKdH2eWBs';
const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

const coaches = [
  {
    email: 'coach.sharma@upasthiti.com',
    password: 'password123',
    firstName: 'Rajesh',
    lastName: 'Sharma',
    primarySkill: 'Badminton Coach',
    experienceYears: 8,
    bio: 'National-level badminton player and certified coach. Specializes in advanced footwork, tactical game development, and high-performance competitive training.',
    slug: 'rajesh-sharma-badminton',
    rating: 4.80,
    serviceTypes: ['Offline', 'Hybrid'],
    classTypes: ['Group Classes', 'One-to-One'],
    languages: ['English', 'Hindi']
  },
  {
    email: 'coach.iyer@upasthiti.com',
    password: 'password123',
    firstName: 'Priyanka',
    lastName: 'Iyer',
    primarySkill: 'Yoga Coach',
    experienceYears: 10,
    bio: 'Certified Hatha and Vinyasa Yoga instructor. Specializes in mindfulness, flexibility enhancement, restorative breathing, and yoga for sports injury prevention.',
    slug: 'priyanka-iyer-yoga',
    rating: 4.90,
    serviceTypes: ['Online', 'Offline', 'Hybrid'],
    classTypes: ['Group Classes', 'One-to-One'],
    languages: ['English', 'Hindi', 'Tamil']
  }
];

async function main() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const tenantId = '022c1494-057e-4c80-80dd-88fa4b1287b5'; // VidyaSopan Sports school

  // Connect to DB via PG to manage profiles directly
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to database for coach sync!');

  for (const c of coaches) {
    console.log(`\nProcessing coach: ${c.firstName} ${c.lastName} (${c.email})`);

    // 1. Create or get user in Supabase Auth
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing users:', listError.message);
      continue;
    }

    let authUser = usersData.users.find(u => u.email === c.email);
    let userId;

    if (!authUser) {
      console.log('Creating auth account...');
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: c.email,
        password: c.password,
        email_confirm: true,
        app_metadata: {
          role: 'coach',
          tenant_id: tenantId
        },
        user_metadata: {
          first_name: c.firstName,
          last_name: c.lastName
        }
      });

      if (createError) {
        console.error('Failed to create auth user:', createError.message);
        continue;
      }

      userId = createData.user.id;
      console.log('Auth user created successfully! ID:', userId);
    } else {
      userId = authUser.id;
      console.log('Auth user already exists. ID:', userId);
    }

    // 2. Ensure profile exists in public.users
    const userRes = await client.query('SELECT role FROM public.users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      console.log('Inserting into public.users table...');
      await client.query(`
        INSERT INTO public.users (id, tenant_id, email, role, first_name, last_name, phone, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, 'coach', $4, $5, null, true, now(), now())
      `, [userId, tenantId, c.email, c.firstName, c.lastName]);
    } else {
      console.log('Updating role in public.users to coach...');
      await client.query(`
        UPDATE public.users SET role = 'coach' WHERE id = $1
      `, [userId]);
    }

    // 3. Ensure coach entry exists in public.coaches
    const coachRes = await client.query('SELECT id FROM public.coaches WHERE id = $1', [userId]);
    if (coachRes.rows.length === 0) {
      console.log('Inserting into public.coaches table...');
      await client.query(`
        INSERT INTO public.coaches (
          id, tenant_id, primary_skill, experience_years, service_types, 
          class_types, languages_known, bio, public_profile_slug, avg_rating, 
          employment_status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Active', now(), now())
      `, [
        userId, tenantId, c.primarySkill, c.experienceYears, c.serviceTypes,
        c.classTypes, c.languages, c.bio, c.slug, c.rating
      ]);
      console.log('Coach professional profile created successfully!');
    } else {
      console.log('Updating public.coaches details...');
      await client.query(`
        UPDATE public.coaches 
        SET primary_skill = $2, experience_years = $3, service_types = $4,
            class_types = $5, languages_known = $6, bio = $7, public_profile_slug = $8,
            avg_rating = $9, employment_status = 'Active', updated_at = now()
        WHERE id = $1
      `, [
        userId, c.primarySkill, c.experienceYears, c.serviceTypes,
        c.classTypes, c.languages, c.bio, c.slug, c.rating
      ]);
      console.log('Coach professional profile updated successfully!');
    }
  }

  await client.end();
  console.log('\nSync complete. Both demo coaches are now fully active!');
}

main();
