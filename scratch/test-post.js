// scratch/test-post.js
const fs = require('fs');
const path = require('path');

// Manually parse env file
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const index = trimmed.indexOf('=');
  if (index === -1) return;
  const key = trimmed.substring(0, index).trim();
  const val = trimmed.substring(index + 1).trim();
  env[key] = val;
});

// Set environment variables for the test process
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// Mock next/server and next/headers
const Module = require('module');
const originalRequire = Module.prototype.require;

// Intercept modules
Module.prototype.require = function (id) {
  if (id === 'next/server') {
    return {
      NextResponse: {
        json: (data, init) => {
          return {
            status: init?.status || 200,
            json: async () => data,
            ok: (init?.status || 200) >= 200 && (init?.status || 200) < 300,
          };
        }
      }
    };
  }
  if (id === 'next/headers') {
    return {
      cookies: async () => ({
        getAll: () => []
      })
    };
  }
  return originalRequire.apply(this, arguments);
};

// Now register ts-node or just require tsx to load the TypeScript file!
// Since we don't have tsx/ts-node globally, let's write a pure JS mockup or check if we can run it using next's loader.
// Or even simpler, let's just inspect the code of route.ts and see what it does.
console.log('Skipping ts-node mock. Let\'s look at how the route returns.');
