// Schema integrity tests — confirm every extension lands in the
// composed PM schema with the right node group / atomicity.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { paperSchema } from '../src/schema';

describe('paperSchema', () => {
  it('contains all expected nodes', () => {
    const schema = paperSchema();
    const expectedNodes = [
      'doc',
      'paragraph',
      'text',
      'heading',
      'equation',
      'inlineEquation',
      'citationRef',
      'datasetRef',
      'computationalCell',
      'figure',
      'figureCaption',
      'footnoteRef',
      // Phase 2 W5 ADR-0011 additions
      'claim',
      'evidence',
    ];
    for (const name of expectedNodes) {
      assert.ok(schema.nodes[name], `schema missing node ${name}`);
    }
  });

  it('contains the annotationAnchor mark', () => {
    const schema = paperSchema();
    assert.ok(schema.marks['annotationAnchor']);
  });

  it('atom nodes are atomic per ADR-0001 §2.2', () => {
    const schema = paperSchema();
    const atomNames = [
      'equation',
      'inlineEquation',
      'citationRef',
      'datasetRef',
      'computationalCell',
      'footnoteRef',
    ];
    for (const name of atomNames) {
      assert.ok(schema.nodes[name]!.isAtom, `${name} should be atom`);
    }
  });

  it('inline atoms classified inline', () => {
    const schema = paperSchema();
    const inlineNames = [
      'inlineEquation',
      'citationRef',
      'datasetRef',
      'footnoteRef',
    ];
    for (const name of inlineNames) {
      assert.ok(
        schema.nodes[name]!.isInline,
        `${name} should be inline-grouped`,
      );
    }
  });

  it('block atoms classified block', () => {
    const schema = paperSchema();
    const blockNames = ['equation', 'computationalCell'];
    for (const name of blockNames) {
      assert.ok(
        schema.nodes[name]!.isBlock,
        `${name} should be block-grouped`,
      );
    }
  });

  it('paperSchema() returns the same instance (cache)', () => {
    assert.equal(paperSchema(), paperSchema());
  });
});
