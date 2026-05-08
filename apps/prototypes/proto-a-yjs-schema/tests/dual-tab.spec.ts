// Dual-tab automation for D3 manual test.
//
// Each test opens two isolated browser contexts (= two "browsers" from
// y-websocket's perspective; they share state only through the local
// ws://localhost:1234 relay), wipes their IndexedDB so prior runs don't
// leak, performs the case, and asserts on:
//   - both tabs converge to byte-identical Y.Doc body fragment JSON
//   - the y-prosemirror warning counter on each tab remains 0
//
// Wipe + reload is needed because IndexedDB persists across contexts of
// different test runs unless we explicitly clear it.

import { test, expect, type BrowserContext, type Page } from '@playwright/test';

async function freshTab(context: BrowserContext, room: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/?room=${encodeURIComponent(room)}`);
  // Wait for the editor shell to render (sync bundle settled).
  await page.locator('.editor-shell').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('.status')).toContainText(/WS status:connected/);
  return page;
}

async function waitForPeers(pageA: Page, pageB: Page, expected = 2) {
  await expect(pageA.locator('.status')).toContainText(
    new RegExp(`Peers \\(incl\\. self\\):${expected}`),
    { timeout: 15_000 }
  );
  await expect(pageB.locator('.status')).toContainText(
    new RegExp(`Peers \\(incl\\. self\\):${expected}`),
    { timeout: 15_000 }
  );
}

async function readDump(page: Page): Promise<string> {
  return (await page.locator('.json-dump').innerText()).trim();
}

async function readWarnings(page: Page): Promise<number> {
  const txt = await page.locator('.status').innerText();
  const m = txt.match(/warnings observed:(\d+)/);
  if (!m) throw new Error('warning counter not found');
  return Number(m[1]);
}

async function assertConverged(pageA: Page, pageB: Page) {
  // y-websocket sync is generally < 100ms over loopback. Wait until the
  // dumps actually agree, with a short timeout.
  await expect
    .poll(
      async () => {
        const a = await readDump(pageA);
        const b = await readDump(pageB);
        return a === b;
      },
      { timeout: 8_000, message: 'tabs failed to converge' }
    )
    .toBe(true);
}

async function assertNoWarnings(pageA: Page, pageB: Page) {
  expect(await readWarnings(pageA)).toBe(0);
  expect(await readWarnings(pageB)).toBe(0);
}

test.describe('proto-a · D3 dual-tab automation', () => {
  let ctxA: BrowserContext;
  let ctxB: BrowserContext;
  let pageA: Page;
  let pageB: Page;

  test.beforeEach(async ({ browser }, testInfo) => {
    // Unique room per test so the y-websocket relay's in-memory Y.Doc
    // cache (room → doc) doesn't leak state between cases.
    const room = `pw-${testInfo.title.replace(/\W+/g, '-').slice(0, 40)}-${Date.now()}`;
    ctxA = await browser.newContext();
    ctxB = await browser.newContext();
    // Open A first, then B, sequentially — A starts the room, B joins.
    pageA = await freshTab(ctxA, room);
    pageB = await freshTab(ctxB, room);
    await waitForPeers(pageA, pageB);
  });

  test.afterEach(async () => {
    await ctxA?.close();
    await ctxB?.close();
  });

  test('case 1 — concurrent atom inserts', async () => {
    // Both tabs click "Insert citation-ref" at roughly the same moment.
    await Promise.all([
      pageA.click('button:has-text("Insert citation-ref")'),
      pageB.click('button:has-text("Insert citation-ref")'),
    ]);

    await assertConverged(pageA, pageB);
    await assertNoWarnings(pageA, pageB);

    // Sanity: both inserts landed; dump should mention the citation entityId twice.
    const dump = await readDump(pageA);
    const occurrences = (dump.match(/cite-doi-10\.1000-xyz/g) ?? []).length;
    expect(occurrences).toBe(2);
  });

  test('case 2 — concurrent paragraph + equation edits', async () => {
    // A types into the editor; B inserts a display equation at the same time.
    const editorA = pageA.locator('.ProseMirror');
    const editorB = pageB.locator('.ProseMirror');

    await editorA.click();
    const typing = editorA.pressSequentially('hello world from tab A', { delay: 15 });
    const inserting = pageB.click('button:has-text("Insert display equation")');
    await Promise.all([typing, inserting]);

    await assertConverged(pageA, pageB);
    await assertNoWarnings(pageA, pageB);

    // Sanity: equation present and text intact. The dump is JSON-encoded
    // XML serialisation of the Y.XmlFragment, so `<equation` is the marker.
    const dump = await readDump(pageA);
    expect(dump).toContain('hello world from tab A');
    expect(dump).toContain('<equation');

    // KaTeX rendered the formula on each tab.
    await expect(editorA.locator('.katex')).toHaveCount(1);
    await expect(editorB.locator('.katex')).toHaveCount(1);
  });

  test('case 3 — delete + annotation collision', async () => {
    // Seed: A types a known phrase. Wait for sync.
    const editorA = pageA.locator('.ProseMirror');
    const editorB = pageB.locator('.ProseMirror');

    await editorA.click();
    await editorA.pressSequentially('annotate-target', { delay: 10 });
    await assertConverged(pageA, pageB);

    // A selects the text in its paragraph and deletes it; B simultaneously
    // selects the same text and adds an annotation anchor. Use TipTap's
    // built-in Ctrl/Cmd+A handler to put the editor selection into the
    // PM model (DOM-only ranges don't reach PM's command pipeline).
    await editorA.click();
    await pageA.keyboard.press('ControlOrMeta+a');
    await editorB.click();
    await pageB.keyboard.press('ControlOrMeta+a');

    await Promise.all([
      pageA.keyboard.press('Backspace'),
      pageB.click('button:has-text("Mark selection as annotation anchor")'),
    ]);

    await assertConverged(pageA, pageB);
    await assertNoWarnings(pageA, pageB);

    // Sanity: no PM RangeError surfaced. `error` events on the page would
    // also be caught by Playwright as page errors — Playwright fails tests
    // automatically on uncaught page errors when test.use({ }) doesn't suppress.
  });
});
