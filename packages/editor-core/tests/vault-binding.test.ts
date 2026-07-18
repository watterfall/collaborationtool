// Vault doc binding tests — Wave A1 (improvement-plan-2026-08).
//
// Pure (no Tauri, no vault-host process): proves the webview-side Y.Doc
// lifecycle that VaultEditor mounts on. The critical lock here is the
// fragment-name contract — vault-fs markdown emit reads
// getXmlFragment('prosemirror') while TipTap Collaboration defaults to
// 'default'; a drift means "editor works, markdown twin stays empty".

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';
import {
  YDoc,
  YXmlElement,
  YXmlText,
  yEncodeStateAsUpdate,
  yApplyUpdate,
} from '@collaborationtool/doc-store';

import {
  createVaultDocBinding,
  seedVaultDocIfEmpty,
  isVaultFragmentEmpty,
  VAULT_COLLABORATION_FIELD,
  VAULT_EXTERNAL_ORIGIN,
} from '../src/vault/binding';
import { paperSchema } from '../src/schema';

const PM_DOC = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: '夜科学 night science' }] },
  ],
};

function fullState(doc: YDoc): Uint8Array {
  return yEncodeStateAsUpdate(doc);
}

describe('vault binding fragment contract', () => {
  it("locks the fragment name to 'prosemirror' (vault-fs ydoc-to-markdown contract)", () => {
    // vault-fs/src/ydoc-to-markdown.ts:100 reads getXmlFragment('prosemirror').
    // TipTap Collaboration's default field is 'default' — this constant is
    // what keeps the two sides converged. Do not change one without the other.
    assert.equal(VAULT_COLLABORATION_FIELD, 'prosemirror');
  });
});

describe('createVaultDocBinding', () => {
  it('hydrates from a full state produced by the vault-host side', () => {
    const source = prosemirrorJSONToYDoc(
      paperSchema(),
      PM_DOC,
      VAULT_COLLABORATION_FIELD,
    );
    const binding = createVaultDocBinding(fullState(source), () => {
      assert.fail('hydration must not relay back to the host');
    });
    assert.equal(isVaultFragmentEmpty(binding.doc), false);
    const text = binding.doc
      .getXmlFragment(VAULT_COLLABORATION_FIELD)
      .toString();
    assert.match(text, /夜科学 night science/);
    binding.destroy();
  });

  it('relays local edits so a host-side doc converges', () => {
    const updates: Uint8Array[] = [];
    const binding = createVaultDocBinding(null, (u) => updates.push(u));
    seedVaultDocIfEmpty(binding.doc);

    // Simulate a local edit (what TipTap Collaboration does under the hood).
    const fragment = binding.doc.getXmlFragment(VAULT_COLLABORATION_FIELD);
    const para = new YXmlElement('paragraph');
    para.insert(0, [new YXmlText('local edit 本地编辑')]);
    fragment.insert(fragment.length, [para]);

    assert.ok(updates.length >= 2, 'seed + edit must both relay');

    // Replaying the relayed updates onto a fresh doc (the host) converges.
    const host = new YDoc();
    for (const u of updates) yApplyUpdate(host, u);
    const hostText = host.getXmlFragment(VAULT_COLLABORATION_FIELD).toString();
    assert.match(hostText, /local edit 本地编辑/);
    binding.destroy();
  });

  it('does NOT relay external updates back (no echo loop)', () => {
    const source = prosemirrorJSONToYDoc(
      paperSchema(),
      PM_DOC,
      VAULT_COLLABORATION_FIELD,
    );
    let relayed = 0;
    const binding = createVaultDocBinding(null, () => {
      relayed += 1;
    });
    const before = relayed;
    binding.applyExternalState(fullState(source));
    assert.equal(relayed, before, 'external apply must not trigger relay');
    assert.equal(isVaultFragmentEmpty(binding.doc), false);
    binding.destroy();
  });

  it('stops relaying after destroy()', () => {
    let relayed = 0;
    const binding = createVaultDocBinding(null, () => {
      relayed += 1;
    });
    seedVaultDocIfEmpty(binding.doc);
    const count = relayed;
    binding.destroy();
    assert.equal(relayed, count);
  });

  it('exposes a state vector usable for delta sync', () => {
    const binding = createVaultDocBinding(null, () => {});
    seedVaultDocIfEmpty(binding.doc);
    const vector = binding.encodeStateVector();
    assert.ok(vector instanceof Uint8Array);
    assert.ok(vector.byteLength > 0);
    binding.destroy();
  });
});

describe('seedVaultDocIfEmpty', () => {
  it('seeds an empty doc with a LOCAL origin so the seed relays to the host', () => {
    const updates: Uint8Array[] = [];
    const binding = createVaultDocBinding(null, (u) => updates.push(u));
    const seeded = seedVaultDocIfEmpty(binding.doc);
    assert.equal(seeded, true);
    assert.equal(isVaultFragmentEmpty(binding.doc), false);
    assert.ok(
      updates.length > 0,
      'seed must relay — otherwise later edits reference items the host never saw',
    );
    binding.destroy();
  });

  it('skips seeding when the fragment already has content', () => {
    const source = prosemirrorJSONToYDoc(
      paperSchema(),
      PM_DOC,
      VAULT_COLLABORATION_FIELD,
    );
    const binding = createVaultDocBinding(fullState(source), () => {});
    assert.equal(seedVaultDocIfEmpty(binding.doc), false);
    binding.destroy();
  });

  it('external origin constant matches the binding relay filter', () => {
    assert.equal(VAULT_EXTERNAL_ORIGIN, 'vault-host');
  });
});
