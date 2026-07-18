'use client';

// VaultEditor — TipTap bound to a local vault document (no sync-gateway).
//
// 桌面端 vault 编辑器：不走 WebSocket / IndexedDB，Y.Doc 由
// createVaultDocBinding 水合自 vault-host `doc.open` 的全量 state；本地
// 编辑增量经 onLocalUpdate 交给调用方推回 Node host（doc.applyUpdate），
// 外部变更由调用方经 binding.applyExternalState 注入。
//
// StrictMode-safe（同 Editor.tsx 模式）：binding 在 useEffect 里创建、
// cleanup 里 destroy；TipTap 只在 binding 就绪后挂载（immediatelyRender:
// true 安全 —— 内层组件只在 client effect 之后渲染，SSR 永远不会碰到）。

import Collaboration from '@tiptap/extension-collaboration';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor as TipTapEditor } from '@tiptap/core';
import { useEffect, useRef, useState } from 'react';

import { PAPER_SCHEMA_EXTENSIONS } from './extensions/all';
import {
  createVaultDocBinding,
  seedVaultDocIfEmpty,
  VAULT_COLLABORATION_FIELD,
  type VaultDocBinding,
} from './vault/binding';

export interface VaultEditorProps {
  /** Full Y.Doc state from vault-host `doc.open` (base64-decoded). */
  initialState: Uint8Array;
  /** Incremental local updates — push each to `doc.applyUpdate`. */
  onLocalUpdate: (update: Uint8Array) => void;
  /** Binding handle for external-edit reloads (applyExternalState). */
  onBindingReady?: (binding: VaultDocBinding) => void;
  onEditorReady?: (editor: TipTapEditor) => void;
  readOnly?: boolean;
}

export function VaultEditor(props: VaultEditorProps): React.ReactElement {
  const [binding, setBinding] = useState<VaultDocBinding | null>(null);
  const onLocalUpdateRef = useRef(props.onLocalUpdate);
  const onBindingReadyRef = useRef(props.onBindingReady);
  const onEditorReadyRef = useRef(props.onEditorReady);
  onLocalUpdateRef.current = props.onLocalUpdate;
  onBindingReadyRef.current = props.onBindingReady;
  onEditorReadyRef.current = props.onEditorReady;

  // The doc identity is per-mount: a different file must remount the
  // component (key it on the document path in the caller).
  const initialStateRef = useRef(props.initialState);

  useEffect(() => {
    const b = createVaultDocBinding(initialStateRef.current, (update) => {
      onLocalUpdateRef.current(update);
    });
    seedVaultDocIfEmpty(b.doc);
    setBinding(b);
    onBindingReadyRef.current?.(b);
    return () => {
      setBinding(null);
      b.destroy();
    };
  }, []);

  if (!binding) {
    return <div data-vault-editor="hydrating" />;
  }
  return (
    <VaultEditorMounted
      binding={binding}
      readOnly={props.readOnly ?? false}
      onEditorReadyRef={onEditorReadyRef}
    />
  );
}

interface VaultEditorMountedProps {
  binding: VaultDocBinding;
  readOnly: boolean;
  onEditorReadyRef: React.MutableRefObject<
    ((editor: TipTapEditor) => void) | undefined
  >;
}

function VaultEditorMounted({
  binding,
  readOnly,
  onEditorReadyRef,
}: VaultEditorMountedProps): React.ReactElement {
  const editor: TipTapEditor | null = useEditor(
    {
      extensions: [
        ...PAPER_SCHEMA_EXTENSIONS,
        Collaboration.configure({
          document: binding.doc,
          field: VAULT_COLLABORATION_FIELD,
        }),
      ],
      editable: !readOnly,
      immediatelyRender: true,
    },
    [binding.doc, readOnly],
  );

  useEffect(() => {
    if (editor) {
      onEditorReadyRef.current?.(editor);
    }
  }, [editor, onEditorReadyRef]);

  if (!editor) {
    return <div data-vault-editor="mounting" />;
  }
  return <EditorContent editor={editor} data-vault-editor="ready" />;
}
