// packages/database/src/index.ts
// Main entry point for the @upasthiti/database package
// Re-exports everything needed by apps/web and apps/mobile

export { createSupabaseBrowserClient } from './client';
export { createSupabaseServerClient } from './server';
export type { Database } from './types';
