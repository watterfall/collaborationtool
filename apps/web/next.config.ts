import type { NextConfig } from 'next';

const config: NextConfig = {
  // Drizzle + postgres-js are CommonJS-friendly server-only deps; mark
  // them as external so Next's bundler doesn't try to bundle them into
  // the edge runtime.
  serverExternalPackages: [
    'postgres',
    'drizzle-orm',
    'better-auth',
    '@collaborationtool/drizzle',
    '@collaborationtool/permissions',
  ],
  reactStrictMode: true,
  experimental: {
    // Phase 1 not using ppr / typed routes; revisit Phase 2.
  },
};

export default config;
