// @collaborationtool/identity — Phase 6 W2-W3 (ADR-0018 §2.1).
//
// ed25519 keypair + argon2id-derived encryption + ORCID identity link.
// Substrate for Merkle-signed provenance per ADR-0018.

export * from './_shared';
export * from './keypair';
export * from './sign';
export * from './vault-keys-io';
export * from './orcid-link';
