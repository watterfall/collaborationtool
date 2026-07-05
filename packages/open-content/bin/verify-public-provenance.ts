#!/usr/bin/env tsx

import { readFile } from 'node:fs/promises';

import {
  verifyPublicProvenanceBundle,
  verifyPublicProvenanceResponse,
  type PublicProvenanceApiResponse,
  type PublicProvenanceVerificationBundle,
} from '../src/index';

const target = process.argv[2];

if (!target) {
  console.error(
    'usage: pnpm --filter @collaborationtool/open-content verify:provenance <file-or-url>',
  );
  process.exitCode = 2;
} else {
  const raw = await readTarget(target);
  const parsed = JSON.parse(raw) as
    | PublicProvenanceApiResponse
    | PublicProvenanceVerificationBundle;
  const result = isPublicProvenanceResponse(parsed)
    ? verifyPublicProvenanceResponse(parsed)
    : verifyPublicProvenanceBundle(parsed);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'invalid' ? 1 : 0;
}

async function readTarget(target: string): Promise<string> {
  if (/^https?:\/\//.test(target)) {
    const response = await fetch(target);
    if (!response.ok) {
      throw new Error(`failed to fetch ${target}: HTTP ${response.status}`);
    }
    return response.text();
  }
  return readFile(target, 'utf8');
}

function isPublicProvenanceResponse(
  value: unknown,
): value is PublicProvenanceApiResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'record' in value &&
    'reviews' in value
  );
}
