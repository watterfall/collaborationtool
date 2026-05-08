// Public API of @collaborationtool/permissions.
//
// Importing rules (enforced by review, lint guard arrives Phase 1.5):
//   - Code outside this package MUST NOT use string literals like
//     'document.read' anywhere — import the constant from `capabilities`.
//   - Role names ('paper-author' etc.) similarly come from `roles`.
//   - The capability checker is the only entry point for "may principal X
//     do Y" questions; never roll your own.

export * from './capabilities';
export * from './resources';
export * from './roles';
export * from './connection-mode';
export * from './checker';
export * from './jwt';
export * from './acl-loader';
