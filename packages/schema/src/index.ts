// @collaborationtool/schema — single source of truth for the 8 core entities.
// See plan0/adr/0001-data-model-and-crdt-split.md for full rationale and
// the Y.Doc / Postgres bucket convention.

export * from './_shared';
export * from './principal';
export * from './agent';
export * from './document';
export * from './block';
export * from './citation';
export * from './annotation';
export * from './revision';
export * from './contribution';
export * from './provenance';
