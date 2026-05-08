import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Collaboration } from '@tiptap/extension-collaboration';
import * as Y from 'yjs';

import { setupSync, type SyncBundle } from './sync/setup-sync';
import { PROTO_A_EXTENSIONS } from './extensions/all';

const ROOM_NAME = 'proto-a-yjs-schema-default-room';

const SAMPLE_LATEX = String.raw`E = mc^2`;
const SAMPLE_INLINE_LATEX = String.raw`\alpha + \beta`;

function jsonDump(doc: Y.Doc): string {
  // Compact representation for status panel: PM doc JSON if available;
  // fallback to fragment toString.
  const fragment = doc.getXmlFragment('body');
  return JSON.stringify(fragment.toJSON(), null, 2);
}

export function App() {
  const syncRef = useRef<SyncBundle | null>(null);
  const [synced, setSynced] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [docDump, setDocDump] = useState('');
  const [warningCount, setWarningCount] = useState(0);

  // Wire sync once.
  if (!syncRef.current) {
    syncRef.current = setupSync({ roomName: ROOM_NAME });
  }
  const sync = syncRef.current;

  useEffect(() => {
    sync.ready.then(() => setSynced(true));
    const updatePeers = () => setPeerCount(sync.webrtc.awareness.getStates().size);
    sync.webrtc.awareness.on('change', updatePeers);
    updatePeers();

    // Patch console.warn to count y-prosemirror schema-recovery warnings.
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const msg = args.map((a) => String(a)).join(' ');
      if (msg.toLowerCase().includes('prosemirror') || msg.toLowerCase().includes('y-prosemirror')) {
        setWarningCount((c) => c + 1);
      }
      originalWarn(...args);
    };

    return () => {
      sync.webrtc.awareness.off('change', updatePeers);
      console.warn = originalWarn;
    };
  }, [sync]);

  const editor = useEditor({
    extensions: useMemo(
      () => [
        ...PROTO_A_EXTENSIONS,
        Collaboration.configure({
          document: sync.ydoc,
          field: 'body',
        }),
      ],
      [sync]
    ),
    content: '',
  });

  useEffect(() => {
    if (!editor) return;
    const refresh = () => setDocDump(jsonDump(sync.ydoc));
    refresh();
    const fragment = sync.ydoc.getXmlFragment('body');
    const onChange = () => refresh();
    fragment.observeDeep(onChange);
    return () => fragment.unobserveDeep(onChange);
  }, [editor, sync]);

  if (!editor) return <div>Loading editor…</div>;

  return (
    <>
      <header>
        <h1>proto-a · y-prosemirror heterogeneous schema</h1>
        <small>
          Open this URL in two browser tabs (same origin) to test concurrent
          editing. Sync goes through y-indexeddb (local persistence) +
          y-webrtc (peer-to-peer via public signalling).
        </small>
      </header>

      <div className="status">
        <span>
          <span className="label">Indexeddb synced:</span>
          {synced ? 'yes' : 'loading…'}
        </span>
        {' · '}
        <span>
          <span className="label">Peers (incl. self):</span>
          {peerCount}
        </span>
        {' · '}
        <span>
          <span className="label">y-prosemirror warnings observed:</span>
          {warningCount}
        </span>
      </div>

      <div className="toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertCitationRef('cite-doi-10.1000-xyz', 'Smith 2024')
              .run()
          }
        >
          Insert citation-ref
        </button>
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertDatasetRef('dataset-zenodo-12345', 'IPUMS Cohort 2024')
              .run()
          }
        >
          Insert dataset-ref
        </button>
        <button
          onClick={() =>
            editor.chain().focus().insertEquation(SAMPLE_LATEX).run()
          }
        >
          Insert display equation
        </button>
        <button
          onClick={() =>
            editor.chain().focus().insertInlineEquation(SAMPLE_INLINE_LATEX).run()
          }
        >
          Insert inline equation
        </button>
        <button
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertComputationalCell(
                'molab',
                "import marimo as mo\nmo.md('Hello, paper!')"
              )
              .run()
          }
        >
          Insert computational cell
        </button>
        <button
          onClick={() =>
            editor.chain().focus().insertFootnoteRef('', '*').run()
          }
        >
          Insert footnote-ref
        </button>
        <button
          onClick={() => editor.chain().focus().addAnnotationAnchor().run()}
        >
          Mark selection as annotation anchor
        </button>
        <button
          onClick={() => editor.chain().focus().removeAnnotationAnchor().run()}
        >
          Unmark annotation anchor
        </button>
      </div>

      <div className="editor-shell">
        <EditorContent editor={editor} />
      </div>

      <h3 style={{ marginTop: 24, fontSize: 14 }}>Y.Doc body fragment (live):</h3>
      <pre className="json-dump">{docDump}</pre>

      <h3 style={{ marginTop: 24, fontSize: 14 }}>Manual test cases (run in two tabs):</h3>
      <ol style={{ fontSize: 13, color: '#444' }}>
        <li>
          <b>Concurrent atom inserts</b>: in tab 1 click "Insert citation-ref"
          while tab 2 also clicks "Insert citation-ref". Expected: both refs
          appear, in stable order. <i>Watch: warning counter stays 0; no
          duplicate node ids.</i>
        </li>
        <li>
          <b>Concurrent paragraph + equation edits</b>: tab 1 types in paragraph,
          tab 2 inserts a display equation just before. Expected: both edits
          merge cleanly, equation renders via KaTeX, paragraph text intact.
        </li>
        <li>
          <b>Delete + annotation collision</b>: tab 1 selects a block and
          deletes it (Backspace). Tab 2, simultaneously, selects text inside
          that block and clicks "Mark selection as annotation anchor".
          Expected: anchor either lands on remaining text or vanishes
          gracefully — no orphan mark, no PM RangeError, no recovery warning.
        </li>
      </ol>
    </>
  );
}
