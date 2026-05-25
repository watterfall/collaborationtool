import type { NextConfig } from 'next';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Dedupe yjs to a single resolved file path. Without this, pnpm symlinks
// + transpilePackages can surface yjs to webpack from two different
// physical locations (workspace package vs hoisted), instantiating the
// module twice — y-prosemirror's Collaboration plugin then fails its
// internal `instanceof Y.XmlFragment` checks and the editor mounts as a
// blank non-interactive box. The warning "Yjs was already imported"
// in dev logs is the smoking gun. `yjs$` is an exact-match alias so
// `import 'yjs'` resolves to one file; subpath imports (`yjs/utils`)
// are unaffected.
const yjsEntry = require.resolve('yjs');

const config: NextConfig = {
  // Drizzle + postgres-js are CommonJS-friendly server-only deps; mark
  // them as external so Next's bundler doesn't try to bundle them into
  // the edge runtime.
  serverExternalPackages: [
    'postgres',
    'drizzle-orm',
    'better-auth',
    '@anthropic-ai/sdk',
    '@modelcontextprotocol/sdk',
    '@collaborationtool/drizzle',
    '@collaborationtool/permissions',
    '@collaborationtool/ai-runtime',
    '@collaborationtool/mcp-server-crossref-mock',
  ],
  // editor-core ships ESM with TipTap / Yjs / KaTeX deps; we want Next
  // to transpile it as part of the app bundle so pnpm-workspace ESM
  // packages don't trip dual-package hazards.
  transpilePackages: [
    '@collaborationtool/editor-core',
    '@collaborationtool/doc-store',
  ],
  reactStrictMode: true,
  experimental: {
    // Phase 1 not using ppr / typed routes; revisit Phase 2.
  },
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      yjs$: yjsEntry,
    };
    return cfg;
  },
};

export default config;
