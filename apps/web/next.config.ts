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
  // editor-core ships ESM with TipTap / Yjs / KaTeX deps; we want Next
  // to transpile it as part of the app bundle so pnpm-workspace ESM
  // packages don't trip dual-package hazards.
  transpilePackages: ['@collaborationtool/editor-core'],
  reactStrictMode: true,
  experimental: {
    // Phase 1 not using ppr / typed routes; revisit Phase 2.
  },
};

export default config;
