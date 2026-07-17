'use client';

// Vault surface client — vault-host-bridge 的第一个真实调用方（Wave A1）。
//
// 链路：vault_open（Rust 原生，建 .vault/ skeleton）→ vault_host_start
// （spawn Node host）→ vault.open / vault.watch（chokidar 外部编辑监听）
// → vault_list_documents → doc.open（全量 Y.Doc state base64）→
// VaultEditor（field='prosemirror'，见 editor-core vault/binding.ts 契约
// 注释）→ 本地增量 doc.applyUpdate 串行推回 → 离开时 doc.flush。
// 外部编辑事件（"vault-host://event"）→ 顶部 notice + 手动 Reload
// （doc.state 带 state vector 只拿 delta）。

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  VaultEditor,
  type TipTapEditor,
  type VaultDocBinding,
} from '@collaborationtool/editor-core';

import { isTauri, safeListen } from '@/lib/desktop-bridge';
import { openVault, listVaultDocuments, type VaultInfo } from '@/lib/vault-bridge';
import {
  startVaultHost,
  openVaultSession,
  watchVaultSession,
  openVaultDocument,
  vaultDocumentState,
  applyVaultDocumentUpdate,
  flushVaultDocument,
} from '@/lib/vault-host-bridge';
import { base64ToBytes, bytesToBase64 } from '@/lib/bytes';
import {
  parseVaultHostEvent,
  VAULT_HOST_EVENT,
  type VaultHostEvent,
} from '@/lib/vault-events';
import { Button, EmptyState, HairlineList, HairlineRule, ListRow, StatusPill } from '@/components/design';

export interface VaultCopy {
  title: string;
  titleEn: string;
  lede: string;
  webFallback: string;
  webFallbackEn: string;
  rootLabel: string;
  rootPlaceholder: string;
  open: string;
  opening: string;
  hostError: string;
  documents: string;
  noDocuments: string;
  noDocumentsEn: string;
  back: string;
  externalEdit: string;
  reload: string;
  dismiss: string;
  watching: string;
}

interface OpenDoc {
  relativePath: string;
  id: string;
  initialState: Uint8Array;
}

type Phase = 'idle' | 'opening' | 'ready' | 'error';

export default function VaultClient({ copy }: { copy: VaultCopy }) {
  const [tauri, setTauri] = useState<boolean | null>(null);
  const [root, setRoot] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [info, setInfo] = useState<VaultInfo | null>(null);
  const [docs, setDocs] = useState<string[]>([]);
  const [openDoc, setOpenDoc] = useState<OpenDoc | null>(null);
  const [externalEvent, setExternalEvent] = useState<VaultHostEvent | null>(
    null,
  );

  const bindingRef = useRef<VaultDocBinding | null>(null);
  const editorRef = useRef<TipTapEditor | null>(null);
  // Serialised update pump — preserves Yjs update order over the RPC.
  const pumpRef = useRef<Promise<unknown>>(Promise.resolve());
  const openDocRef = useRef<OpenDoc | null>(null);
  openDocRef.current = openDoc;
  const rootRef = useRef(root);

  // isTauri touches globals — resolve after mount to stay SSR-safe.
  useEffect(() => {
    setTauri(isTauri());
  }, []);

  const handleOpenVault = useCallback(async () => {
    const trimmed = root.trim();
    if (!trimmed) return;
    setPhase('opening');
    rootRef.current = trimmed;
    const opened = await openVault(trimmed);
    const host = await startVaultHost();
    const session = host ? await openVaultSession(trimmed) : null;
    if (!opened || !host || !session) {
      setPhase('error');
      return;
    }
    await watchVaultSession(trimmed);
    const list = await listVaultDocuments(trimmed);
    setInfo(opened);
    setDocs(list ?? []);
    setPhase('ready');
  }, [root]);

  const handleOpenDocument = useCallback(async (relativePath: string) => {
    const state = await openVaultDocument(rootRef.current, relativePath);
    if (!state) return;
    setExternalEvent(null);
    setOpenDoc({
      relativePath,
      id: state.id,
      initialState: base64ToBytes(state.stateBase64),
    });
  }, []);

  const handleLocalUpdate = useCallback((update: Uint8Array) => {
    const doc = openDocRef.current;
    if (!doc) return;
    const encoded = bytesToBase64(update);
    pumpRef.current = pumpRef.current.then(() =>
      applyVaultDocumentUpdate(rootRef.current, doc.id, encoded),
    );
  }, []);

  const handleCloseDocument = useCallback(async () => {
    const doc = openDocRef.current;
    if (doc) {
      await pumpRef.current;
      await flushVaultDocument(rootRef.current, doc.id);
    }
    bindingRef.current = null;
    editorRef.current = null;
    setOpenDoc(null);
    setExternalEvent(null);
  }, []);

  const handleReload = useCallback(async () => {
    const doc = openDocRef.current;
    const binding = bindingRef.current;
    if (!doc || !binding) return;
    const delta = await vaultDocumentState(
      rootRef.current,
      doc.id,
      bytesToBase64(binding.encodeStateVector()),
    );
    if (delta) {
      binding.applyExternalState(base64ToBytes(delta.stateBase64));
    }
    setExternalEvent(null);
  }, []);

  // External-edit push events for the whole vault session.
  useEffect(() => {
    if (phase !== 'ready') return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void safeListen<unknown>(VAULT_HOST_EVENT, (raw) => {
      const event = parseVaultHostEvent(raw);
      if (!event || event.root !== rootRef.current) return;
      setExternalEvent(event);
    }).then((fn) => {
      if (cancelled) fn?.();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [phase]);

  // Flush on unmount (navigation away with a doc still open).
  useEffect(() => {
    return () => {
      const doc = openDocRef.current;
      if (doc) {
        void flushVaultDocument(rootRef.current, doc.id);
      }
    };
  }, []);

  const heading = (
    <header>
      <h2
        className="text-2xl"
        style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-ink)' }}
      >
        {copy.title}{' '}
        <span style={{ color: 'var(--color-ink-3)' }}>· {copy.titleEn}</span>
      </h2>
      <p className="mt-1 text-sm italic" style={{ color: 'var(--color-ink-2)' }}>
        {copy.lede}
      </p>
    </header>
  );

  if (tauri === null) {
    return <section className="mx-auto max-w-3xl px-6 py-10">{heading}</section>;
  }

  if (!tauri) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        {heading}
        <div className="mt-8">
          <EmptyState message={copy.webFallback} messageEn={copy.webFallbackEn} />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-10" data-vault-surface>
      {heading}

      {phase !== 'ready' && (
        <div className="mt-8 flex flex-col gap-3">
          <label
            className="text-xs"
            style={{ color: 'var(--color-ink-2)' }}
            htmlFor="vault-root"
          >
            {copy.rootLabel}
          </label>
          <div className="flex gap-3">
            <input
              id="vault-root"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              placeholder={copy.rootPlaceholder}
              className="flex-1 px-3 py-2 text-sm"
              style={{
                border: '1px solid var(--color-hairline)',
                background: 'var(--color-paper)',
                color: 'var(--color-ink)',
              }}
            />
            <Button
              onClick={() => void handleOpenVault()}
              disabled={phase === 'opening' || root.trim() === ''}
            >
              {phase === 'opening' ? copy.opening : copy.open}
            </Button>
          </div>
          {phase === 'error' && (
            <p className="text-sm" style={{ color: 'var(--color-ink-2)' }}>
              {copy.hostError}
            </p>
          )}
        </div>
      )}

      {phase === 'ready' && !openDoc && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm" style={{ color: 'var(--color-ink-2)' }}>
              {copy.documents}
              <span className="ml-2" style={{ color: 'var(--color-ink-3)' }}>
                {info?.root}
              </span>
            </h3>
            <StatusPill status="applied" label="监听中" labelEn="Watching" />
          </div>
          <HairlineRule className="mt-2" />
          {docs.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                message={copy.noDocuments}
                messageEn={copy.noDocumentsEn}
              />
            </div>
          ) : (
            <HairlineList className="mt-2">
              {docs.map((relativePath) => (
                <ListRow
                  key={relativePath}
                  title={relativePath}
                  trailing={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleOpenDocument(relativePath)}
                    >
                      打开 · Open
                    </Button>
                  }
                />
              ))}
            </HairlineList>
          )}
        </div>
      )}

      {phase === 'ready' && openDoc && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <Button variant="link" size="sm" onClick={() => void handleCloseDocument()}>
              {copy.back}
            </Button>
            <span className="text-xs" style={{ color: 'var(--color-ink-3)' }}>
              {openDoc.relativePath}
            </span>
          </div>
          {externalEvent && (
            <div
              className="mt-3 flex items-center justify-between px-3 py-2"
              style={{ border: '1px solid var(--color-hairline)' }}
              role="status"
            >
              <span className="text-sm" style={{ color: 'var(--color-ink)' }}>
                {copy.externalEdit}
                <span className="ml-2" style={{ color: 'var(--color-ink-3)' }}>
                  {externalEvent.path}
                </span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" onClick={() => void handleReload()}>
                  {copy.reload}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExternalEvent(null)}
                >
                  {copy.dismiss}
                </Button>
              </span>
            </div>
          )}
          <HairlineRule className="mt-3" />
          <div className="mt-4" data-prose="bilingual">
            <VaultEditor
              key={openDoc.relativePath}
              initialState={openDoc.initialState}
              onLocalUpdate={handleLocalUpdate}
              onBindingReady={(b) => {
                bindingRef.current = b;
              }}
              onEditorReady={(e) => {
                editorRef.current = e;
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
