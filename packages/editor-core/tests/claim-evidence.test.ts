// Phase 2 W5 ADR-0011: Claim + Evidence PM block container tests.
//
// Coverage:
//   - schema instantiation accepts claim/evidence as block nodes
//   - JSON round-trip preserves all attrs (id / claimType / status / confidence
//     / supportsClaimId / citationId / relation)
//   - claim/evidence accept paragraph children (rich text body)
//   - default attrs match ADR-0011 §2.1 spec

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Node as PmNode } from '@tiptap/pm/model';

import { paperSchema } from '../src/schema';

describe('Claim + Evidence — schema integrity (ADR-0011)', () => {
  it('schema includes claim + evidence as block group', () => {
    const schema = paperSchema();
    const claimSpec = schema.nodes['claim'];
    const evidenceSpec = schema.nodes['evidence'];
    assert.ok(claimSpec, 'claim node missing');
    assert.ok(evidenceSpec, 'evidence node missing');
    assert.ok(claimSpec.spec.group?.includes('block'));
    assert.ok(evidenceSpec.spec.group?.includes('block'));
  });

  it('claim accepts paragraph children (content="paragraph+")', () => {
    const schema = paperSchema();
    const node = schema.nodes['claim']!.create(
      {
        blockId: 'b1',
        claimId: 'c1',
        claimType: 'main',
        status: 'human-reviewed',
        confidence: 'high',
      },
      schema.nodes['paragraph']!.create(
        null,
        schema.text('Markdown will remain a strong source format.'),
      ),
    );
    assert.equal(node.type.name, 'claim');
    assert.equal(node.childCount, 1);
    assert.equal(node.firstChild!.type.name, 'paragraph');
    assert.match(node.textContent, /Markdown/);
  });

  it('evidence accepts paragraph children + supportsClaimId attr', () => {
    const schema = paperSchema();
    const node = schema.nodes['evidence']!.create(
      {
        blockId: 'b2',
        evidenceId: 'e1',
        supportsClaimId: 'c1',
        citationId: 'cite-001',
        relation: 'supports',
        status: 'human-reviewed',
      },
      schema.nodes['paragraph']!.create(
        null,
        schema.text('Markdown is portable, Git-friendly, and easy for LLMs.'),
      ),
    );
    assert.equal(node.type.name, 'evidence');
    assert.equal(node.attrs['supportsClaimId'], 'c1');
    assert.equal(node.attrs['relation'], 'supports');
  });

  it('claim default attrs: claimType=main, status=ai-suggested, confidence=medium', () => {
    const schema = paperSchema();
    // Use schema default-attr factory (parseHTML provides defaults).
    const node = schema.nodes['claim']!.createAndFill({
      blockId: 'b1',
      claimId: 'c1',
    });
    assert.ok(node);
    assert.equal(node!.attrs['claimType'], 'main');
    assert.equal(node!.attrs['status'], 'ai-suggested');
    assert.equal(node!.attrs['confidence'], 'medium');
  });

  it('evidence default relation = supports / status = ai-suggested', () => {
    const schema = paperSchema();
    const node = schema.nodes['evidence']!.createAndFill({
      blockId: 'b2',
      evidenceId: 'e1',
      supportsClaimId: 'c1',
    });
    assert.ok(node);
    assert.equal(node!.attrs['relation'], 'supports');
    assert.equal(node!.attrs['status'], 'ai-suggested');
    assert.equal(node!.attrs['citationId'], null);
  });

  it('JSON round-trip preserves all claim attrs', () => {
    const schema = paperSchema();
    const original = schema.nodes['claim']!.create(
      {
        blockId: 'b1',
        claimId: 'c-roundtrip',
        claimType: 'counter',
        status: 'approved',
        confidence: 'low',
      },
      schema.nodes['paragraph']!.create(null, schema.text('Counter point.')),
    );
    const json = original.toJSON();
    const reparsed = PmNode.fromJSON(schema, json);
    assert.equal(reparsed.attrs['claimId'], 'c-roundtrip');
    assert.equal(reparsed.attrs['claimType'], 'counter');
    assert.equal(reparsed.attrs['status'], 'approved');
    assert.equal(reparsed.attrs['confidence'], 'low');
    assert.equal(reparsed.textContent, 'Counter point.');
  });

  it('JSON round-trip preserves all evidence attrs', () => {
    const schema = paperSchema();
    const original = schema.nodes['evidence']!.create(
      {
        blockId: 'b2',
        evidenceId: 'e-roundtrip',
        supportsClaimId: 'c-target',
        citationId: 'cite-foo',
        relation: 'challenges',
        status: 'approved',
      },
      schema.nodes['paragraph']!.create(null, schema.text('Counter evidence.')),
    );
    const json = original.toJSON();
    const reparsed = PmNode.fromJSON(schema, json);
    assert.equal(reparsed.attrs['evidenceId'], 'e-roundtrip');
    assert.equal(reparsed.attrs['supportsClaimId'], 'c-target');
    assert.equal(reparsed.attrs['citationId'], 'cite-foo');
    assert.equal(reparsed.attrs['relation'], 'challenges');
  });

  it('claim with synthesis claimType is allowed (essay §15)', () => {
    const schema = paperSchema();
    const node = schema.nodes['claim']!.create(
      {
        blockId: 'b3',
        claimId: 'synth-1',
        claimType: 'synthesis',
        status: 'approved',
        confidence: 'high',
      },
      schema.nodes['paragraph']!.create(
        null,
        schema.text('The future is not Markdown vs HTML, but...'),
      ),
    );
    assert.equal(node.attrs['claimType'], 'synthesis');
  });
});
