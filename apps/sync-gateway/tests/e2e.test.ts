// E2E tests for the sync gateway. Starts a real WebSocketServer + a real
// Postgres-backed ACL loader, then drives it with raw `ws` clients.
//
// Skips when DATABASE_URL is unset.

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { eq } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import WebSocket from 'ws';

import {
  openDatabase,
  schema,
  type Database,
} from '@collaborationtool/drizzle';
import {
  DEFAULT_ROLE_BUNDLES,
  materialiseRoleBundle,
  signSyncToken,
  syncTokenSecretFromString,
} from '@collaborationtool/permissions';

import { CLOSE_CODES, loadEnv } from '../src/index';
import { FRAME_KIND, decodeFrame } from '../src/doc-room';
import { startGateway } from '../src/server';

const DATABASE_URL = process.env['DATABASE_URL'];
const SHOULD_SKIP = !DATABASE_URL;

if (SHOULD_SKIP) {
  describe('sync-gateway e2e', { skip: true }, () => {
    it('skipped (no DATABASE_URL)', () => {});
  });
} else {
  describe('sync-gateway e2e', () => {
    const SECRET = syncTokenSecretFromString(
      'sync-gateway-test-secret-32-chars-padding-here',
    );
    const ISSUER = 'test.web';
    const AUDIENCE = 'sync-gateway';

    let dbHandle!: ReturnType<typeof openDatabase>;
    let db!: Database;
    let handle!: Awaited<ReturnType<typeof startGateway>>;

    let documentId!: string;
    let authorPrincipalId!: string;
    let reviewerPrincipalId!: string;
    let commenterPrincipalId!: string;

    before(async () => {
      // Stand up the test gateway with a known-secret + ephemeral port.
      process.env['SYNC_TOKEN_SECRET'] =
        'sync-gateway-test-secret-32-chars-padding-here';
      process.env['SYNC_TOKEN_ISSUER'] = ISSUER;
      process.env['SYNC_TOKEN_AUDIENCE'] = AUDIENCE;
      process.env['HEARTBEAT_MS'] = '600000'; // long, manual ticks instead
      process.env['LOG_LEVEL'] = 'error';
      process.env['DATABASE_URL'] = DATABASE_URL;

      dbHandle = openDatabase({ url: DATABASE_URL });
      db = dbHandle.db;

      // Seed minimal fixture: 3 principals + 1 document + 3 ACL rows.
      authorPrincipalId = `user:${uuidv7()}`;
      reviewerPrincipalId = `user:${uuidv7()}`;
      commenterPrincipalId = `user:${uuidv7()}`;
      documentId = uuidv7();
      const slugSuffix = documentId.replace(/-/g, '').slice(0, 24);

      await db.insert(schema.principal).values([
        {
          id: authorPrincipalId,
          kind: 'user',
          displayName: 'Author A',
          userId: `u-${uuidv7()}`,
        },
        {
          id: reviewerPrincipalId,
          kind: 'user',
          displayName: 'Reviewer C',
          userId: `u-${uuidv7()}`,
        },
        {
          id: commenterPrincipalId,
          kind: 'user',
          displayName: 'Commenter D',
          userId: `u-${uuidv7()}`,
        },
      ]);

      await db.insert(schema.document).values({
        id: documentId,
        ownerPrincipalId: authorPrincipalId,
        primaryLanguage: 'zh-Hans',
        slug: `gw-e2e-${slugSuffix}`,
      });

      await materialiseRoleBundle(db, {
        documentId,
        principalId: authorPrincipalId,
        roleId: 'paper-author',
        capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
      });
      await materialiseRoleBundle(db, {
        documentId,
        principalId: reviewerPrincipalId,
        roleId: 'paper-reviewer',
        capabilities: DEFAULT_ROLE_BUNDLES['paper-reviewer'],
      });
      await materialiseRoleBundle(db, {
        documentId,
        principalId: commenterPrincipalId,
        roleId: 'commenter',
        capabilities: DEFAULT_ROLE_BUNDLES['commenter'],
      });

      const env = loadEnv();
      handle = await startGateway({ env, db, port: 0 });
    });

    after(async () => {
      await handle.close();
      await dbHandle.close();
    });

    async function connect(opts: {
      principalId: string;
      docId?: string;
      tokenDocId?: string;
      explicitToken?: string;
    }): Promise<{
      ws: WebSocket;
      modeFrame: Promise<{ kind: number; payload: string }>;
    }> {
      const docId = opts.docId ?? documentId;
      const tokenDoc = opts.tokenDocId ?? docId;
      const token =
        opts.explicitToken ??
        (await signSyncToken(
          { sub: opts.principalId as never, doc: tokenDoc as never },
          SECRET,
          { issuer: ISSUER, audience: AUDIENCE },
        ));
      const url = `ws://127.0.0.1:${handle.port}/ws?docId=${encodeURIComponent(
        docId,
      )}&token=${encodeURIComponent(token)}`;

      const ws = new WebSocket(url);
      const modeFrame = new Promise<{ kind: number; payload: string }>(
        (resolve, reject) => {
          ws.once('error', reject);
          ws.on('message', (data) => {
            const frame = decodeFrame(data as Buffer);
            if (frame.kind === FRAME_KIND.MODE_SET) {
              resolve({ kind: frame.kind, payload: frame.payload.toString('utf8') });
            }
          });
        },
      );
      await new Promise<void>((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      return { ws, modeFrame };
    }

    function nextFrame(ws: WebSocket): Promise<{ kind: number; payload: Buffer }> {
      return new Promise((resolve, reject) => {
        ws.once('message', (data) => resolve(decodeFrame(data as Buffer)));
        ws.once('error', reject);
        ws.once('close', (code, reason) =>
          reject(new Error(`closed code=${code} reason=${reason.toString('utf8')}`)),
        );
      });
    }

    function nextClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
      return new Promise((resolve) => {
        ws.once('close', (code, reason) =>
          resolve({ code, reason: reason.toString('utf8') }),
        );
      });
    }

    async function expectImmediateClose(opts: {
      principalId: string;
      docId?: string;
      tokenDocId?: string;
      explicitToken?: string;
    }): Promise<{ code: number }> {
      // Returns the close code after the upgrade is rejected. ws library
      // exposes a 'unexpected-response' event when the server returns
      // HTTP 4xx instead of 101.
      const docId = opts.docId ?? documentId;
      const tokenDoc = opts.tokenDocId ?? docId;
      const token =
        opts.explicitToken ??
        (await signSyncToken(
          { sub: opts.principalId as never, doc: tokenDoc as never },
          SECRET,
          { issuer: ISSUER, audience: AUDIENCE },
        ));
      const url = `ws://127.0.0.1:${handle.port}/ws?docId=${encodeURIComponent(
        docId,
      )}&token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      return new Promise((resolve, reject) => {
        ws.on('unexpected-response', (_req, res) => {
          ws.terminate();
          resolve({ code: res.statusCode ?? 0 });
        });
        ws.on('open', () => {
          ws.terminate();
          reject(new Error('expected upgrade rejection but got open'));
        });
        ws.on('error', () => {
          // some rejections come as ECONNRESET — surface as code 0
          resolve({ code: 0 });
        });
      });
    }

    // ---------- handshake ----------

    it('rejects upgrade when token is missing', async () => {
      const url = `ws://127.0.0.1:${handle.port}/ws?docId=${documentId}`;
      const ws = new WebSocket(url);
      const result = await new Promise<number>((resolve) => {
        ws.on('unexpected-response', (_req, res) => {
          ws.terminate();
          resolve(res.statusCode ?? 0);
        });
        ws.on('error', () => resolve(0));
      });
      assert.equal(result, 400);
    });

    it('rejects upgrade when token is invalid', async () => {
      const url = `ws://127.0.0.1:${handle.port}/ws?docId=${documentId}&token=garbage`;
      const ws = new WebSocket(url);
      const result = await new Promise<number>((resolve) => {
        ws.on('unexpected-response', (_req, res) => {
          ws.terminate();
          resolve(res.statusCode ?? 0);
        });
        ws.on('error', () => resolve(0));
      });
      assert.equal(result, 401);
    });

    it('rejects upgrade when token doc-id mismatches URL doc-id', async () => {
      const result = await expectImmediateClose({
        principalId: authorPrincipalId,
        docId: documentId,
        tokenDocId: 'doc:other-document',
      });
      assert.equal(result.code, 401);
    });

    it('rejects upgrade when principal has no ACL row', async () => {
      const principalId = `user:${uuidv7()}`;
      // No insert into principal — but loader query just returns empty,
      // which our auth treats as no-acl.
      await db.insert(schema.principal).values({
        id: principalId,
        kind: 'user',
        displayName: 'No-ACL',
        userId: `u-${uuidv7()}`,
      });
      const result = await expectImmediateClose({ principalId });
      assert.equal(result.code, 401);
    });

    // ---------- mode classification ----------

    it('paper-author connects as writer', async () => {
      const { ws, modeFrame } = await connect({ principalId: authorPrincipalId });
      const m = await modeFrame;
      assert.equal(m.payload, 'writer');
      ws.close();
    });

    it('paper-reviewer connects as proposer', async () => {
      const { ws, modeFrame } = await connect({ principalId: reviewerPrincipalId });
      const m = await modeFrame;
      assert.equal(m.payload, 'proposer');
      ws.close();
    });

    it('commenter connects as reader', async () => {
      const { ws, modeFrame } = await connect({ principalId: commenterPrincipalId });
      const m = await modeFrame;
      assert.equal(m.payload, 'reader');
      ws.close();
    });

    // ---------- update routing ----------

    it('writer body update is broadcast to other writer/reader/proposer', async () => {
      // Connect 3 clients before sending; capture the body update on each.
      const author = await connect({ principalId: authorPrincipalId });
      const reviewer = await connect({ principalId: reviewerPrincipalId });
      const commenter = await connect({ principalId: commenterPrincipalId });

      // Drain the mode_set frames first.
      await Promise.all([author.modeFrame, reviewer.modeFrame, commenter.modeFrame]);

      // Author sends a body update.
      const payload = Buffer.from([0xaa, 0xbb, 0xcc]);
      const reviewerNext = nextFrame(reviewer.ws);
      const commenterNext = nextFrame(commenter.ws);
      author.ws.send(Buffer.concat([Buffer.from([FRAME_KIND.BODY_UPDATE]), payload]));

      const got1 = await reviewerNext;
      const got2 = await commenterNext;
      assert.equal(got1.kind, FRAME_KIND.BODY_UPDATE);
      assert.deepEqual(Array.from(got1.payload), Array.from(payload));
      assert.equal(got2.kind, FRAME_KIND.BODY_UPDATE);
      assert.deepEqual(Array.from(got2.payload), Array.from(payload));

      author.ws.close();
      reviewer.ws.close();
      commenter.ws.close();
    });

    it('reader send is rejected with update_rejected frame', async () => {
      const reader = await connect({ principalId: commenterPrincipalId });
      await reader.modeFrame;
      const next = nextFrame(reader.ws);
      reader.ws.send(
        Buffer.concat([Buffer.from([FRAME_KIND.BODY_UPDATE]), Buffer.from([0x01])]),
      );
      const f = await next;
      assert.equal(f.kind, FRAME_KIND.UPDATE_REJECTED);
      assert.match(f.payload.toString('utf8'), /reader|cannot/);
      reader.ws.close();
    });

    it('proposer send routes to draft (writer sees DRAFT_UPDATE, not BODY_UPDATE)', async () => {
      const author = await connect({ principalId: authorPrincipalId });
      const reviewer = await connect({ principalId: reviewerPrincipalId });
      await Promise.all([author.modeFrame, reviewer.modeFrame]);

      const next = nextFrame(author.ws);
      reviewer.ws.send(
        Buffer.concat([Buffer.from([FRAME_KIND.BODY_UPDATE]), Buffer.from([0x99])]),
      );

      const f = await next;
      // Author should receive a DRAFT_UPDATE, not a BODY_UPDATE.
      assert.equal(f.kind, FRAME_KIND.DRAFT_UPDATE);
      // Skip the 4-byte length + draftId, then the trailing payload byte.
      const idLen = f.payload.readUInt32BE(0);
      const tail = f.payload.subarray(4 + idLen);
      assert.deepEqual(Array.from(tail), [0x99]);

      author.ws.close();
      reviewer.ws.close();
    });

    // ---------- room state visibility ----------

    it('rooms map is exposed for admin / debug', async () => {
      const { ws, modeFrame } = await connect({ principalId: authorPrincipalId });
      await modeFrame;
      assert.ok(handle.rooms.has(documentId));
      const room = handle.rooms.get(documentId)!;
      assert.ok(room.members.size >= 1);
      ws.close();
    });

    // ---------- revocation ----------

    it('revoking ACL closes the connection on next heartbeat', async () => {
      // Stand up a fresh principal that we can revoke.
      const principalId = `user:${uuidv7()}`;
      await db.insert(schema.principal).values({
        id: principalId,
        kind: 'user',
        displayName: 'Will be revoked',
        userId: `u-${uuidv7()}`,
      });
      await materialiseRoleBundle(db, {
        documentId,
        principalId,
        roleId: 'paper-author',
        capabilities: DEFAULT_ROLE_BUNDLES['paper-author'],
      });

      // Configure a much shorter heartbeat for this test by spinning a
      // second gateway on the same db.
      process.env['HEARTBEAT_MS'] = '200';
      const fastEnv = loadEnv();
      process.env['HEARTBEAT_MS'] = '600000';
      const fastHandle = await startGateway({ env: fastEnv, db, port: 0 });

      try {
        const token = await signSyncToken(
          { sub: principalId as never, doc: documentId as never },
          SECRET,
          { issuer: ISSUER, audience: AUDIENCE },
        );
        const ws = new WebSocket(
          `ws://127.0.0.1:${fastHandle.port}/ws?docId=${encodeURIComponent(
            documentId,
          )}&token=${encodeURIComponent(token)}`,
        );
        await new Promise<void>((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });
        const closed = nextClose(ws);

        // Now revoke by deleting the ACL row.
        await db
          .delete(schema.documentAcl)
          .where(eq(schema.documentAcl.principalId, principalId));

        const c = await closed;
        assert.equal(c.code, CLOSE_CODES.REVOKED);
      } finally {
        await fastHandle.close();
      }
    });
  });
}
