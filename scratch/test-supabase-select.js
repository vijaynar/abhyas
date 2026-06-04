const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in apps/web/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  // Let's find one user first
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, email')
    .limit(1)
    .single();

  if (userErr) {
    console.error('Error fetching user:', userErr);
    return;
  }

  console.log('Querying for user:', user.email);

  const { data: profile, error } = await supabase
    .from('users')
    .select(`
      id, email, first_name, last_name, role, available_roles, tenants(name, slug),
      roles(
        role_permissions(
          permissions(
            module,
            action
          )
        )
      )
    `)
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching permissions nested:', error);
  } else {
    console.log('Success nested permissions:', JSON.stringify(profile, null, 2));
  }
}

main();
