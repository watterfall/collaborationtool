import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { schema } from '@collaborationtool/drizzle';
import type { DbExecutor } from '@collaborationtool/drizzle';

import {
  buildOpenContentSignatureVerifier,
  normalizeEd25519PublicKeyText,
} from '@/lib/open-content-signature';

export interface PrincipalSignatureVerifierInput {
  db: DbExecutor;
  principalId: string;
  submittedPublicKey: unknown;
  scope: string;
  allowDevFallback?: boolean;
}

export interface PrincipalSignatureVerifier {
  verifier: (signedJws: string, payload: unknown) => boolean;
  publicKeyForVerification: string | null;
  publicKeyToPersist: string | null;
}

export async function buildPrincipalOpenContentSignatureVerifier(
  input: PrincipalSignatureVerifierInput,
): Promise<PrincipalSignatureVerifier> {
  const storedRows = await input.db
    .select({ ed25519PublicKey: schema.principal.ed25519PublicKey })
    .from(schema.principal)
    .where(eq(schema.principal.id, input.principalId))
    .limit(1);
  const storedPublicKey = normalizeEd25519PublicKeyText(
    storedRows[0]?.ed25519PublicKey ?? null,
  );
  const submittedPublicKey = normalizeEd25519PublicKeyText(input.submittedPublicKey);

  if (
    storedPublicKey &&
    typeof input.submittedPublicKey === 'string' &&
    input.submittedPublicKey.trim().length > 0 &&
    submittedPublicKey !== storedPublicKey
  ) {
    return {
      verifier: () => false,
      publicKeyForVerification: storedPublicKey,
      publicKeyToPersist: null,
    };
  }

  const publicKeyForVerification =
    storedPublicKey ?? submittedPublicKey ?? input.submittedPublicKey;

  return {
    verifier: buildOpenContentSignatureVerifier({
      scope: input.scope,
      publicKey: publicKeyForVerification,
      allowDevFallback: input.allowDevFallback,
    }),
    publicKeyForVerification:
      typeof publicKeyForVerification === 'string'
        ? normalizeEd25519PublicKeyText(publicKeyForVerification)
        : null,
    publicKeyToPersist: storedPublicKey ? null : submittedPublicKey,
  };
}

export async function persistPrincipalEd25519PublicKeyIfNeeded(
  db: DbExecutor,
  principalId: string,
  publicKeyToPersist: string | null,
): Promise<void> {
  if (!publicKeyToPersist) return;
  await db
    .update(schema.principal)
    .set({ ed25519PublicKey: publicKeyToPersist })
    .where(
      and(
        eq(schema.principal.id, principalId),
        isNull(schema.principal.ed25519PublicKey),
      ),
    );
}

export function allowOpenContentDevSignatureFallback(): boolean {
  return process.env['NODE_ENV'] !== 'production';
}
