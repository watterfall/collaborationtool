// Wave D-1 — Unit tests for the 4 角色分化 (ADR-0020 §2.4).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ROLES,
  DEFAULT_SURFACE_BY_ROLE,
  ROLE_LABELS_ZH,
  ROLE_LABELS_EN,
  isRole,
  parseRole,
} from '../src/role';

describe('Role taxonomy (ADR-0020 §2.4 — 4 角色分化)', () => {
  it('has exactly 4 roles', () => {
    assert.equal(ROLES.length, 4);
  });

  it('contains the 4 expected roles', () => {
    assert.deepEqual(
      [...ROLES].sort(),
      ['bridge-builder', 'connector', 'explorer', 'validator'],
    );
  });

  it('isRole validates 4 roles', () => {
    for (const r of ROLES) {
      assert.equal(isRole(r), true);
    }
    assert.equal(isRole('admin'), false);
    assert.equal(isRole(null), false);
    assert.equal(isRole(undefined), false);
  });

  it('parseRole returns role or null', () => {
    assert.equal(parseRole('explorer'), 'explorer');
    assert.equal(parseRole('bridge-builder'), 'bridge-builder');
    assert.equal(parseRole('superuser'), null);
    assert.equal(parseRole(''), null);
  });

  it('every role has a default surface starting with /', () => {
    for (const r of ROLES) {
      assert.ok(DEFAULT_SURFACE_BY_ROLE[r]?.startsWith('/'), `bad surface for ${r}`);
    }
  });

  it('surface mapping uses 4 distinct paths', () => {
    const surfaces = ROLES.map((r) => DEFAULT_SURFACE_BY_ROLE[r]);
    assert.equal(new Set(surfaces).size, 4);
  });

  it('every role has both zh and en label', () => {
    for (const r of ROLES) {
      assert.ok(ROLE_LABELS_ZH[r]);
      assert.ok(ROLE_LABELS_EN[r]);
    }
  });
});
