// Phase 4 W6.3 — citation-paste-handler extension.
//
// `.brainstorm/role-user.md §5 P2`：粘 DOI 到段落 → 自动核 → inline 插入
// citation-ref 节点。本文件锁住的是：
//   - DOI_PATTERN / extractDoi 在 ≥ 5 case 上的边界行为（含句末标点、
//     句首大写、嵌入文本、不识别 ISBN/ISSN）
//   - PM `props.handlePaste` 命中 DOI → onLookup 被调用 1 次
//   - paste 不命中 → onLookup 不调用，不阻断默认 paste（return false）
//   - lookupAndInsertCitation 命令成功 → citation-ref node 落到正确位置
//   - 失败 fallback → 文本保留，错误回调收到 doi+reason
//
// 这里只跑 PM 层 + extension shape；真 fetch / DOM hover preview 由 e2e
// 覆盖。stub editor 同 agent-trigger.test.ts pattern。

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EditorState, TextSelection } from '@tiptap/pm/state';

import { paperSchema } from '../src/schema';
import {
  CITATION_LOOKUP_DONE_EVENT,
  CITATION_LOOKUP_FAIL_EVENT,
  CITATION_LOOKUP_START_EVENT,
  CitationPasteHandler,
  DOI_PATTERN,
  citationPasteHandlerPluginKey,
  extractDoi,
} from '../src/extensions/citation-paste-handler';
import type {
  CitationLookupFn,
  CitationLookupResult,
} from '../src/extensions/citation-paste-handler';

// --- DOI regex / extractor ---

describe('DOI_PATTERN — boundary cases', () => {
  it('matches CrossRef sample DOI 10.1145/3531146.3533104', () => {
    assert.ok(DOI_PATTERN.test('10.1145/3531146.3533104'));
    assert.equal(extractDoi('10.1145/3531146.3533104'), '10.1145/3531146.3533104');
  });

  it('strips trailing sentence period: "See 10.1145/3531146.3533104." → no period', () => {
    const doi = extractDoi('See 10.1145/3531146.3533104.');
    assert.equal(doi, '10.1145/3531146.3533104');
  });

  it('matches DOI at sentence start (case-insensitive)', () => {
    const doi = extractDoi('10.48550/arXiv.2310.06770 surveys agentic SE.');
    assert.equal(doi, '10.48550/arXiv.2310.06770');
  });

  it('matches DOI embedded in prose', () => {
    const doi = extractDoi(
      'Reference: 10.1038/s41586-023-06924-6 published in Nature last year.',
    );
    assert.equal(doi, '10.1038/s41586-023-06924-6');
  });

  it('does NOT match ISBN / ISSN-shaped strings', () => {
    assert.equal(extractDoi('ISBN 978-0-13-110362-7'), null);
    assert.equal(extractDoi('ISSN 0028-0836'), null);
  });

  it('does NOT match plain URL paths or filesystem paths', () => {
    assert.equal(extractDoi('See /usr/local/bin/foo for the binary.'), null);
    assert.equal(extractDoi('Visit https://example.com/foo/bar/baz'), null);
  });

  it('matches first DOI when string contains multiple', () => {
    const doi = extractDoi(
      '10.1145/3531146.3533104 and 10.48550/arXiv.2310.06770',
    );
    assert.equal(doi, '10.1145/3531146.3533104');
  });

  it('rejects garbage strings', () => {
    assert.equal(extractDoi(''), null);
    assert.equal(extractDoi('hello world'), null);
    assert.equal(extractDoi('10.0/x'), null); // registrant must be 4-9 digits
  });
});

// --- Extension shape ---

describe('CitationPasteHandler — extension shape', () => {
  it('configure() returns an extension named "citationPasteHandler"', () => {
    const configured = CitationPasteHandler.configure({
      onLookup: () => Promise.reject(new Error('test default')),
    });
    assert.equal(configured.name, 'citationPasteHandler');
  });

  it('default options.onLookup rejects with a "no onLookup configured" message', async () => {
    const configured = CitationPasteHandler.configure();
    const opts = configured.options as { onLookup: CitationLookupFn };
    await assert.rejects(
      () => opts.onLookup({ doi: '10.1145/3531146.3533104' }),
      /no onLookup configured/,
    );
  });

  it('exports stable event channel names (UI hover preview hook)', () => {
    assert.equal(CITATION_LOOKUP_START_EVENT, 'citationPaste:start');
    assert.equal(CITATION_LOOKUP_DONE_EVENT, 'citationPaste:done');
    assert.equal(CITATION_LOOKUP_FAIL_EVENT, 'citationPaste:fail');
    assert.notEqual(CITATION_LOOKUP_START_EVENT, CITATION_LOOKUP_DONE_EVENT);
    assert.notEqual(CITATION_LOOKUP_DONE_EVENT, CITATION_LOOKUP_FAIL_EVENT);
  });

  it('exports a stable plugin key (state plugins can identify it)', () => {
    assert.ok(citationPasteHandlerPluginKey);
  });
});

// --- handlePaste behaviour ---
//
// We exercise the plugin's `handlePaste` directly using a stub view + a
// stub `editor.commands.lookupAndInsertCitation` so we can assert the
// command is called exactly once when a DOI is pasted.

interface StubView {
  state: EditorState;
  dispatch: (tr: ReturnType<EditorState['tr']['insert']>) => void;
  dom: EventTarget;
}

function buildStubEditor(): {
  view: StubView;
  commands: { lookupAndInsertCitation: ((args: { doi: string; position: number }) => boolean) & {
    calls: Array<{ doi: string; position: number }>;
  } };
} {
  const schema = paperSchema();
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, schema.text('Cursor here ')),
  ]);
  const $cursor = doc.resolve(doc.content.size - 1);
  let state = EditorState.create({
    doc,
    selection: TextSelection.between($cursor, $cursor),
  });
  const dom = new EventTarget();
  const view: StubView = {
    get state() {
      return state;
    },
    dispatch: (tr) => {
      state = state.apply(tr);
    },
    dom,
  };
  const calls: Array<{ doi: string; position: number }> = [];
  const fn = (args: { doi: string; position: number }) => {
    calls.push(args);
    return true;
  };
  (fn as unknown as { calls: typeof calls }).calls = calls;
  return {
    view,
    commands: {
      lookupAndInsertCitation: fn as ((args: {
        doi: string;
        position: number;
      }) => boolean) & { calls: typeof calls },
    },
  };
}

/**
 * Invoke the extension's PM plugin handlePaste. Bypass TipTap's Extension
 * lifecycle by accessing `config.addProseMirrorPlugins` directly with a
 * stub `this` shape that mirrors how TipTap binds it: { editor, options }.
 */
function getPastePlugin(
  ext: ReturnType<typeof CitationPasteHandler.configure>,
  editorStub: ReturnType<typeof buildStubEditor>,
) {
  const addFn = (
    ext as unknown as {
      config: {
        addProseMirrorPlugins?: (this: { editor: typeof editorStub; options: unknown }) => unknown[];
      };
    }
  ).config.addProseMirrorPlugins;
  if (typeof addFn !== 'function') {
    throw new Error('addProseMirrorPlugins not present on extension config');
  }
  const ctx = { editor: editorStub, options: ext.options };
  const plugins = addFn.call(ctx as never) as Array<{
    props?: {
      handlePaste?: (view: StubView, event: ClipboardEvent) => boolean;
    };
  }>;
  const handlePaste = plugins[0]?.props?.handlePaste;
  if (typeof handlePaste !== 'function') {
    throw new Error('handlePaste not registered');
  }
  return handlePaste;
}

function makeClipboardEvent(text: string, html = ''): ClipboardEvent {
  let prevented = false;
  const evt = {
    clipboardData: {
      getData(type: string): string {
        if (type === 'text/plain') return text;
        if (type === 'text/html') return html;
        return '';
      },
    },
    preventDefault() {
      prevented = true;
    },
    get defaultPrevented() {
      return prevented;
    },
  };
  return evt as unknown as ClipboardEvent;
}

describe('CitationPasteHandler — handlePaste', () => {
  it('paste containing a DOI: invokes lookupAndInsertCitation command + returns true (default-prevented)', () => {
    const ext = CitationPasteHandler.configure({
      onLookup: () => Promise.reject(new Error('not used in this test')),
    });
    const stub = buildStubEditor();
    const handlePaste = getPastePlugin(ext, stub);
    const evt = makeClipboardEvent('See 10.1145/3531146.3533104 for details.');
    const handled = handlePaste(stub.view, evt);
    assert.equal(handled, true);
    assert.equal((evt as unknown as { defaultPrevented: boolean }).defaultPrevented, true);
    assert.equal(stub.commands.lookupAndInsertCitation.calls.length, 1);
    assert.equal(stub.commands.lookupAndInsertCitation.calls[0]!.doi, '10.1145/3531146.3533104');
    assert.equal(typeof stub.commands.lookupAndInsertCitation.calls[0]!.position, 'number');
  });

  it('paste without a DOI: returns false (defer to default), command not called', () => {
    const ext = CitationPasteHandler.configure({
      onLookup: () => Promise.reject(new Error('not used in this test')),
    });
    const stub = buildStubEditor();
    const handlePaste = getPastePlugin(ext, stub);
    const evt = makeClipboardEvent('just a normal sentence.');
    const handled = handlePaste(stub.view, evt);
    assert.equal(handled, false);
    assert.equal(stub.commands.lookupAndInsertCitation.calls.length, 0);
  });

  it('HTML paste (rich content): returns false even if plain-text contains a DOI', () => {
    const ext = CitationPasteHandler.configure({
      onLookup: () => Promise.reject(new Error('not used in this test')),
    });
    const stub = buildStubEditor();
    const handlePaste = getPastePlugin(ext, stub);
    const evt = makeClipboardEvent(
      '10.1145/3531146.3533104',
      '<p>10.1145/3531146.3533104</p>',
    );
    const handled = handlePaste(stub.view, evt);
    assert.equal(handled, false);
  });
});

// --- lookupAndInsertCitation command end-to-end ---

interface CommandEditor {
  state: EditorState;
  view: { state: EditorState; dispatch: StubView['dispatch']; dom: EventTarget };
  commands: Record<string, unknown>;
}

async function runLookupAndInsertCitation(
  onLookup: CitationLookupFn,
): Promise<{
  success: boolean;
  finalState: EditorState;
  errors: Array<{ doi: string; reason: string }>;
}> {
  const schema = paperSchema();
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, schema.text('Pre ')),
  ]);
  const $cursor = doc.resolve(doc.content.size - 1);
  let state = EditorState.create({
    doc,
    selection: TextSelection.between($cursor, $cursor),
  });
  const errors: Array<{ doi: string; reason: string }> = [];
  const dom = new EventTarget();
  const ext = CitationPasteHandler.configure({
    onLookup,
    onLookupError: (info) => errors.push(info),
  });
  const addCommands = (
    ext as unknown as {
      config: {
        addCommands: (this: {
          editor: CommandEditor;
          options: unknown;
        }) => Record<string, (args: unknown) => (props: unknown) => boolean>;
      };
    }
  ).config.addCommands;
  const editor: CommandEditor = {
    get state() {
      return state;
    },
    view: {
      get state() {
        return state;
      },
      dispatch: (tr) => {
        state = state.apply(tr);
      },
      dom,
    },
    commands: {},
  };
  const cmds = addCommands.call({ editor, options: ext.options });
  const lookupCmd = cmds['lookupAndInsertCitation'];
  if (!lookupCmd) throw new Error('lookupAndInsertCitation factory not exported');
  const tr = state.tr;
  const ok = lookupCmd({
    doi: '10.1145/3531146.3533104',
    position: state.selection.from,
  })({
    editor,
    dispatch: (transaction: ReturnType<EditorState['tr']['insert']>) => {
      state = state.apply(transaction);
    },
    tr,
    state,
  });

  // Wait for async lookup to settle.
  await new Promise((r) => setTimeout(r, 30));

  return { success: ok as boolean, finalState: state, errors };
}

describe('lookupAndInsertCitation command', () => {
  it('on success: replaces inline text with a citationRef atom carrying the lookup label', async () => {
    const onLookup: CitationLookupFn = ({ doi }) =>
      Promise.resolve<CitationLookupResult>({
        citationId: 'cite-test-1',
        label: 'Bommasani 2022',
        cslJson: { DOI: doi, title: 'Foundation Models' },
      });
    const { success, finalState, errors } =
      await runLookupAndInsertCitation(onLookup);
    assert.equal(success, true);
    assert.equal(errors.length, 0);
    let foundCitationRef = false;
    let foundLabel = '';
    finalState.doc.descendants((node) => {
      if (node.type.name === 'citationRef') {
        foundCitationRef = true;
        foundLabel = String(node.attrs['label'] ?? '');
      }
      return true;
    });
    assert.equal(foundCitationRef, true, 'citationRef node should be inserted');
    assert.equal(foundLabel, 'Bommasani 2022');
  });

  it('on failure: errors callback fires with doi + reason; doc retains DOI text', async () => {
    const onLookup: CitationLookupFn = () =>
      Promise.reject(new Error('CrossRef HTTP 503'));
    const { success, finalState, errors } =
      await runLookupAndInsertCitation(onLookup);
    assert.equal(success, true, 'command itself returns true (text inserted)');
    assert.equal(errors.length, 1);
    assert.equal(errors[0]!.doi, '10.1145/3531146.3533104');
    assert.match(errors[0]!.reason, /503/);
    let foundCitationRef = false;
    finalState.doc.descendants((node) => {
      if (node.type.name === 'citationRef') foundCitationRef = true;
      return true;
    });
    assert.equal(foundCitationRef, false, 'no citationRef should be inserted on failure');
    const text = finalState.doc.textContent;
    assert.match(text, /10\.1145\/3531146\.3533104/);
  });

  it('rejects invalid DOI input (defensive guard for menu-driven invocations)', async () => {
    let onLookupCalled = false;
    const schema = paperSchema();
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, schema.text('Pre ')),
    ]);
    const $cursor = doc.resolve(doc.content.size - 1);
    let state = EditorState.create({
      doc,
      selection: TextSelection.between($cursor, $cursor),
    });
    const dom = new EventTarget();
    const ext = CitationPasteHandler.configure({
      onLookup: () => {
        onLookupCalled = true;
        return Promise.resolve<CitationLookupResult>({
          citationId: 'x',
          label: 'x',
        });
      },
    });
    const addCommands = (
      ext as unknown as {
        config: {
          addCommands: (this: {
            editor: CommandEditor;
            options: unknown;
          }) => Record<string, (args: unknown) => (props: unknown) => boolean>;
        };
      }
    ).config.addCommands;
    const editor: CommandEditor = {
      get state() {
        return state;
      },
      view: {
        get state() {
          return state;
        },
        dispatch: (tr) => {
          state = state.apply(tr);
        },
        dom,
      },
      commands: {},
    };
    const cmds = addCommands.call({ editor, options: ext.options });
    const tr = state.tr;
    const ok = cmds['lookupAndInsertCitation']!({
      doi: 'not-a-doi',
      position: state.selection.from,
    })({
      editor,
      dispatch: (transaction: ReturnType<EditorState['tr']['insert']>) => {
        state = state.apply(transaction);
      },
      tr,
      state,
    });
    assert.equal(ok, false, 'invalid DOI returns false (no insertion)');
    assert.equal(onLookupCalled, false, 'onLookup must not be called for invalid DOI');
  });
});
