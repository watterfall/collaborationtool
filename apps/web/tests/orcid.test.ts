// ORCID profile mapper unit tests — pure functions, no better-auth.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildOrcidProviderConfig,
  mapOrcidTokenToProfile,
} from '../src/lib/orcid';

describe('mapOrcidTokenToProfile', () => {
  it('extracts orcid + name; synthesises placeholder email', () => {
    const profile = mapOrcidTokenToProfile({
      access_token: 'abc',
      orcid: '0000-0002-1825-0097',
      name: 'Josiah Carberry',
    });
    assert.equal(profile.orcid, '0000-0002-1825-0097');
    assert.equal(profile.name, 'Josiah Carberry');
    assert.equal(profile.email, '0000-0002-1825-0097@orcid.placeholder');
    assert.equal(profile.emailVerified, false);
  });

  it('uses real email when emailFromExtra is provided', () => {
    const profile = mapOrcidTokenToProfile(
      { orcid: '0000-0002-1825-0097', name: 'Josiah Carberry' },
      { emailFromExtra: 'jc@example.com' },
    );
    assert.equal(profile.email, 'jc@example.com');
    assert.equal(profile.emailVerified, true);
  });

  it('falls back to "ORCID <id>" when name is empty', () => {
    const profile = mapOrcidTokenToProfile({
      orcid: '0009-0001-2345-6789',
      name: '   ',
    });
    assert.equal(profile.name, 'ORCID 0009-0001-2345-6789');
  });

  it('rejects malformed orcid id', () => {
    assert.throws(
      () => mapOrcidTokenToProfile({ orcid: '12345', name: 'x' }),
      /malformed/,
    );
    assert.throws(
      () => mapOrcidTokenToProfile({ orcid: undefined, name: 'x' }),
      /malformed/,
    );
  });

  it('accepts the X check digit at the trailing position', () => {
    const profile = mapOrcidTokenToProfile({
      orcid: '0000-0002-1825-009X',
      name: 'X',
    });
    assert.equal(profile.orcid, '0000-0002-1825-009X');
  });
});

describe('buildOrcidProviderConfig', () => {
  it('uses live orcid.org by default', () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'APP-XYZ',
      clientSecret: 'secret',
      baseUrl: 'https://orcid.org',
    });
    assert.equal(cfg.providerId, 'orcid');
    assert.equal(cfg.clientId, 'APP-XYZ');
    assert.equal(cfg.authorizationUrl, 'https://orcid.org/oauth/authorize');
    assert.equal(cfg.tokenUrl, 'https://orcid.org/oauth/token');
    assert.deepEqual(cfg.scopes, ['/authenticate']);
  });

  it('routes sandbox base url unchanged', () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'x',
      clientSecret: 'y',
      baseUrl: 'https://sandbox.orcid.org',
    });
    assert.equal(cfg.authorizationUrl, 'https://sandbox.orcid.org/oauth/authorize');
  });

  it('mapProfileToUser feeds through mapOrcidTokenToProfile', () => {
    const cfg = buildOrcidProviderConfig({
      clientId: 'x',
      clientSecret: 'y',
      baseUrl: 'https://orcid.org',
    });
    const u = cfg.mapProfileToUser({
      orcid: '0000-0001-2345-6789',
      name: 'Test User',
    });
    assert.equal(u.name, 'Test User');
    assert.equal(u.email, '0000-0001-2345-6789@orcid.placeholder');
    assert.equal(u.emailVerified, false);
  });
});
