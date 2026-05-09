// molab-protocol: typed postMessage protocol between the host page and
// the embedded molab iframe (ADR-0007 §2.3).
//
// 6 message kinds:
//   Host → iframe: cell.config, cell.execute, cell.cancel
//   iframe → Host: cell.ready, cell.progress, cell.executed, cell.error
//
// Wire format: { v: 1, kind: <string>, payload: <object> }.
// All postMessage calls use strict origin 'https://molab.org' (or the
// configured iframe origin); the receiver verifies `event.origin`
// against the configured allowlist before parsing.
//
// JWT for cell.config is signed with SYNC_TOKEN_SECRET, audience
// 'cell-runtime', expires 5 minutes (per ADR-0007 §2.4).

import type { CitationId } from '@collaborationtool/schema';

export const PROTOCOL_VERSION = 1 as const;

/** Branded type for cell evaluation IDs (one per Run click). */
export type CellEvalId = string & { readonly __brand: 'CellEvalId' };

/** Iframe-side message kinds (iframe → host). */
export type InboundKind =
  | 'cell.ready'
  | 'cell.progress'
  | 'cell.executed'
  | 'cell.error';

/** Host-side message kinds (host → iframe). */
export type OutboundKind = 'cell.config' | 'cell.execute' | 'cell.cancel';

export type AnyKind = InboundKind | OutboundKind;

/** ----- Host → iframe payloads ----- */

export interface CellConfigPayload {
  /** Short-lived JWT (5 min, audience 'cell-runtime'). */
  authToken: string;
  /** Pre-signed S3 URLs for input datasets (5 min). */
  datasetUrls: { datasetId: CitationId; signedUrl: string }[];
}

export interface CellExecutePayload {
  sourceCode: string;
  sourceLanguage: 'python' | 'typescript' | 'sql';
  cellEvalId: CellEvalId;
}

export interface CellCancelPayload {
  cellEvalId: CellEvalId;
  reason?: string;
}

/** ----- iframe → Host payloads ----- */

export interface CellReadyPayload {
  kernelVersion: string;
}

export interface CellProgressPayload {
  cellEvalId: CellEvalId;
  /** 0..1 fraction. */
  fraction: number;
  /** Optional tail of stderr for the progress UI; capped to ~512 bytes
   * by the iframe before send. */
  stderrTail?: string;
}

export interface ArtifactPayload {
  /** mimetype-ish hint. */
  type: 'image/png' | 'image/svg+xml' | 'application/json' | 'text/csv' | 'text/plain';
  /** base64-encoded body for binary; UTF-8 string for text. */
  body: string;
  /** Length cap: 5 MB per artifact (ADR-0007 §2.4). */
  byteLength: number;
}

export interface CellExecutedPayload {
  cellEvalId: CellEvalId;
  artifacts: ArtifactPayload[];
}

export interface CellErrorPayload {
  cellEvalId: CellEvalId;
  message: string;
  traceback?: string;
}

/** ----- Discriminated message envelope ----- */

export type OutboundMessage =
  | { v: typeof PROTOCOL_VERSION; kind: 'cell.config'; payload: CellConfigPayload }
  | { v: typeof PROTOCOL_VERSION; kind: 'cell.execute'; payload: CellExecutePayload }
  | { v: typeof PROTOCOL_VERSION; kind: 'cell.cancel'; payload: CellCancelPayload };

export type InboundMessage =
  | { v: typeof PROTOCOL_VERSION; kind: 'cell.ready'; payload: CellReadyPayload }
  | { v: typeof PROTOCOL_VERSION; kind: 'cell.progress'; payload: CellProgressPayload }
  | { v: typeof PROTOCOL_VERSION; kind: 'cell.executed'; payload: CellExecutedPayload }
  | { v: typeof PROTOCOL_VERSION; kind: 'cell.error'; payload: CellErrorPayload };

export type AnyMessage = InboundMessage | OutboundMessage;

/** Limits enforced at parse time. */
export const ARTIFACT_BYTE_LIMIT = 5 * 1024 * 1024; // 5 MB
export const ARTIFACT_COUNT_LIMIT = 16;
export const STDERR_TAIL_LIMIT = 512;
export const JWT_TTL_SECONDS = 300;

/** Type guards / parsers — strict, throw on shape mismatch. */

export class ProtocolError extends Error {
  override name = 'ProtocolError';
}

export function isAnyMessage(value: unknown): value is AnyMessage {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v['v'] === PROTOCOL_VERSION &&
    typeof v['kind'] === 'string' &&
    v['payload'] !== null &&
    typeof v['payload'] === 'object'
  );
}

/** Parse an inbound (iframe → host) message. Throws ProtocolError on
 * version mismatch / unknown kind / artifact-size violation / etc. */
export function parseInbound(value: unknown): InboundMessage {
  if (!isAnyMessage(value)) {
    throw new ProtocolError('inbound: not a v1 envelope');
  }
  const kind = value.kind;
  switch (kind) {
    case 'cell.ready':
    case 'cell.progress':
    case 'cell.executed':
    case 'cell.error':
      break;
    default:
      throw new ProtocolError(`inbound: unknown kind ${kind}`);
  }
  if (kind === 'cell.executed') {
    const arts = (value.payload as CellExecutedPayload).artifacts ?? [];
    if (arts.length > ARTIFACT_COUNT_LIMIT) {
      throw new ProtocolError(
        `inbound cell.executed: too many artifacts (${arts.length} > ${ARTIFACT_COUNT_LIMIT})`,
      );
    }
    for (const a of arts) {
      if (typeof a.byteLength !== 'number' || a.byteLength > ARTIFACT_BYTE_LIMIT) {
        throw new ProtocolError(
          `inbound cell.executed: artifact byteLength ${a.byteLength} > ${ARTIFACT_BYTE_LIMIT}`,
        );
      }
    }
  }
  if (kind === 'cell.progress') {
    const p = value.payload as CellProgressPayload;
    if (typeof p.fraction !== 'number' || p.fraction < 0 || p.fraction > 1) {
      throw new ProtocolError(`inbound cell.progress: fraction out of [0,1]`);
    }
    if (p.stderrTail && p.stderrTail.length > STDERR_TAIL_LIMIT) {
      throw new ProtocolError(
        `inbound cell.progress: stderrTail length ${p.stderrTail.length} > ${STDERR_TAIL_LIMIT}`,
      );
    }
  }
  return value as InboundMessage;
}

/** Parse an outbound (host → iframe) message. Mirror of parseInbound,
 * primarily used by tests / iframe-side validation. */
export function parseOutbound(value: unknown): OutboundMessage {
  if (!isAnyMessage(value)) {
    throw new ProtocolError('outbound: not a v1 envelope');
  }
  const kind = value.kind;
  switch (kind) {
    case 'cell.config':
    case 'cell.execute':
    case 'cell.cancel':
      break;
    default:
      throw new ProtocolError(`outbound: unknown kind ${kind}`);
  }
  return value as OutboundMessage;
}

/** Construct a CellEvalId (uuidv7 in production; tests can pass any
 * non-empty string). Type-cast helper. */
export function asCellEvalId(s: string): CellEvalId {
  if (!s || s.length === 0) {
    throw new ProtocolError('CellEvalId must be non-empty');
  }
  return s as CellEvalId;
}
