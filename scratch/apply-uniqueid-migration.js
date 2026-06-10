const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dcdnfqxvksjznfyktqhg:AUv%23F%23%2CENt4s64%26@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    console.log('Starting migration...');

    // 1. Create the sequence starting at 1029
    await client.query(`
      CREATE SEQUENCE IF NOT EXISTS coach_employee_id_seq START WITH 1029;
    `);
    console.log('Created sequence coach_employee_id_seq starting at 1029');

    // 2. Perform backfill for empty or null employee_id values
    const coachesToBackfill = await client.query(`
      SELECT id, employee_id FROM public.coaches
      WHERE employee_id IS NULL OR employee_id = ''
      ORDER BY created_at ASC;
    `);

    console.log(`Found ${coachesToBackfill.rows.length} coaches that need employee_id backfill.`);

    for (const row of coachesToBackfill.rows) {
      const nextIdResult = await client.query(`SELECT nextval('coach_employee_id_seq') as seq;`);
      const nextSeq = nextIdResult.rows[0].seq;
      const employeeId = `COACH${nextSeq}`;
      
      await client.query(`
        UPDATE public.coaches
        SET employee_id = $1
        WHERE id = $2;
      `, [employeeId, row.id]);

      console.log(`Backfilled coach ${row.id} with employee_id = ${employeeId}`);
    }

    // 3. Create or replace the trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION generate_coach_employee_id()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
          NEW.employee_id := 'COACH' || nextval('coach_employee_id_seq');
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('Created/updated generate_coach_employee_id function');

    // 4. Create the trigger on public.coaches
    await client.query(`
      DROP TRIGGER IF EXISTS trg_coaches_employee_id ON public.coaches;
      CREATE TRIGGER trg_coaches_employee_id
        BEFORE INSERT ON public.coaches
        FOR EACH ROW
        EXECUTE FUNCTION generate_coach_employee_id();
    `);
    console.log('Created/updated trg_coaches_employee_id trigger');

    console.log('Migration completed successfully!');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
