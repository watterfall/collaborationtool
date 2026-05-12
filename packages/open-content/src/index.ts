// @collaborationtool/open-content — Phase 6 W2 P2 (ADR-0018).
//
// Server-side helpers for the 4 open entity types + Merkle-signed
// provenance chain. Pure functions — DB I/O is caller's responsibility.
//
// Substrate consumer of `@collaborationtool/identity` for signature
// verification (DI pattern keeps this package independent of any
// specific identity implementation).

export * from './_shared';
export * from './canonical-payload';
export * from './merkle-log';
