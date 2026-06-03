const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Supabase DB!');

    console.log('Deploying BEFORE INSERT ON auth.users trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.enrich_auth_user_metadata()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.raw_app_meta_data IS NULL THEN
          NEW.raw_app_meta_data := jsonb_build_object('role', 'student', 'tenant_id', '022c1494-057e-4c80-80dd-88fa4b1287b5');
        ELSE
          IF NOT (NEW.raw_app_meta_data ? 'role') THEN
            NEW.raw_app_meta_data := NEW.raw_app_meta_data || jsonb_build_object('role', 'student');
          END IF;
          IF NOT (NEW.raw_app_meta_data ? 'tenant_id') THEN
            NEW.raw_app_meta_data := NEW.raw_app_meta_data || jsonb_build_object('tenant_id', '022c1494-057e-4c80-80dd-88fa4b1287b5');
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trg_enrich_auth_user_metadata ON auth.users CASCADE;
      CREATE TRIGGER trg_enrich_auth_user_metadata
        BEFORE INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.enrich_auth_user_metadata();
    `);
    console.log('BEFORE trigger deployed successfully.');

    console.log('Deploying AFTER INSERT ON auth.users trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
      RETURNS trigger AS $$
      DECLARE
        v_tenant_id uuid;
        v_role varchar(50);
        v_first_name varchar(100);
        v_last_name varchar(100);
      BEGIN
        v_role := coalesce(NEW.raw_app_meta_data->>'role', 'student');
        
        v_tenant_id := coalesce(
          (NEW.raw_app_meta_data->>'tenant_id')::uuid,
          '022c1494-057e-4c80-80dd-88fa4b1287b5'::uuid
        );
        
        v_first_name := coalesce(
          NEW.raw_user_meta_data->>'first_name',
          NEW.raw_user_meta_data->>'name',
          split_part(NEW.email, '@', 1)
        );
        v_last_name := coalesce(
          NEW.raw_user_meta_data->>'last_name',
          ''
        );

        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
          INSERT INTO public.users (id, tenant_id, email, role, first_name, last_name, phone, is_active, created_at, updated_at)
          VALUES (
            NEW.id,
            v_tenant_id,
            NEW.email,
            v_role,
            v_first_name,
            v_last_name,
            NEW.phone,
            true,
            now(),
            now()
          );
        END IF;
        
        IF v_role = 'student' AND NOT EXISTS (SELECT 1 FROM public.students WHERE id = NEW.id) THEN
          INSERT INTO public.students (id, tenant_id, student_custom_id, date_of_birth, joining_date, status, created_at, updated_at)
          VALUES (
            NEW.id,
            v_tenant_id,
            'vs-' || substring(NEW.id::text from 1 for 8),
            '2000-01-01'::date,
            CURRENT_DATE,
            'active',
            now(),
            now()
          );
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trg_sync_auth_user_profile ON auth.users CASCADE;
      CREATE TRIGGER trg_sync_auth_user_profile
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.sync_auth_user_profile();
    `);
    console.log('AFTER trigger deployed successfully.');

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error during migration:', err.message);
  } finally {
    await client.end();
  }
}

main();
