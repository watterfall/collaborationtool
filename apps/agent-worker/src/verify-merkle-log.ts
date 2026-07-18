// Nightly provenance Merkle log verifier — ADR-0018 §2.3 反篡改巡检
// (improvement-plan-2026-08 Wave A4.3).
//
// F4 publish 在写入时校验单行（验签 + content_hash，publish.ts）。但
// "写入时正确"不等于"此后一直正确"——磁盘位翻转、误运维、恶意直改 PG
// 都能在事后破坏 append-only 链。本 worker 每晚把整条链读出来跑
// verifyMerkleChain（open-content 已实现的 4 不变量：单 genesis / entry_seq
// 严格单调 / prev 可解析 / 无 fork），产出结构化报告。
//
// 分层（诚实边界）：
//   - 结构完整性（本 worker 主职）：fork / 重排 / 断链 / 双 genesis —— 这
//     正是 append-only 被破坏的形态，纯 PG 行即可查，无需原始 payload。
//   - 单行签名验证（可选注入）：需要重建当初签名的 canonical payload +
//     signer 公钥（migration 0017 principal.ed25519_public_key）。payload
//     重建是 publish 路径的关注点，故此处作 DI 注入的可选步骤，缺省只跑
//     结构校验。接 @collaborationtool/identity.verify 的真验签在 publish
//     侧暴露 stored canonical payload 后启用。

import { schema, type DbExecutor } from '@collaborationtool/drizzle';
import {
  verifyMerkleChain,
  verifyMerkleEntry,
  type MerkleChainRow,
  type MerkleChainAnomaly,
  type SignedJws,
  type ContentHash,
  type EntityId,
} from '@collaborationtool/open-content';

/** One row as loaded from provenance_merkle_log, ready for structural check. */
export interface LoadedMerkleRow extends MerkleChainRow {
  entityKind: string;
  entityId: string;
  signedJws: SignedJws;
  signerPrincipalId: string;
}

export interface MerkleEntryAnomaly {
  rowId: EntityId;
  reason: string;
}

export interface MerkleLogReport {
  /** ISO timestamp — injected (Date.now not used, resume-safe like workflows). */
  checkedAt: string;
  totalRows: number;
  genesisId: EntityId | null;
  /** Empty structural + entry anomalies = chain healthy. */
  healthy: boolean;
  structuralAnomalies: readonly MerkleChainAnomaly[];
  /** Populated only when a per-entry verifier is supplied. */
  entryAnomalies: readonly MerkleEntryAnomaly[];
  /** True when per-entry signature verification actually ran. */
  entryVerificationRan: boolean;
}

/**
 * Per-entry verify hook. Given a loaded row, reconstruct the canonical
 * payload it signed over and return the pieces verifyMerkleEntry needs,
 * or null to skip this row (payload not reconstructable yet). Injected
 * because canonical payload reconstruction is publish-path-specific.
 */
export type MerkleEntryResolver = (
  row: LoadedMerkleRow,
) => {
  payload: unknown;
  storedContentHash: ContentHash;
  signedJws: SignedJws;
  signatureVerifier: (signedJws: SignedJws, payload: unknown) => boolean;
} | null;

export interface VerifyMerkleLogOptions {
  /** Injected ISO timestamp (resume-safe). */
  now: string;
  /** Optional per-entry signature verifier; omit for structural-only. */
  entryResolver?: MerkleEntryResolver;
}

/**
 * Pure orchestrator — runs structural chain verification and, when an
 * entry resolver is supplied, per-row signature/hash verification. Never
 * throws: a nightly job wants a complete report even on corruption.
 */
export function verifyMerkleLog(
  rows: readonly LoadedMerkleRow[],
  options: VerifyMerkleLogOptions,
): MerkleLogReport {
  const chain = verifyMerkleChain(rows);

  const entryAnomalies: MerkleEntryAnomaly[] = [];
  let entryVerificationRan = false;
  if (options.entryResolver) {
    for (const row of rows) {
      const resolved = options.entryResolver(row);
      if (resolved === null) continue;
      entryVerificationRan = true;
      const result = verifyMerkleEntry({
        storedContentHash: resolved.storedContentHash,
        payload: resolved.payload,
        signedJws: resolved.signedJws,
        signatureVerifier: resolved.signatureVerifier,
      });
      if (!result.valid) {
        entryAnomalies.push({ rowId: row.id, reason: result.reason });
      }
    }
  }

  return {
    checkedAt: options.now,
    totalRows: chain.totalRows,
    genesisId: chain.genesisId,
    healthy: chain.anomalies.length === 0 && entryAnomalies.length === 0,
    structuralAnomalies: chain.anomalies,
    entryAnomalies,
    entryVerificationRan,
  };
}

/** Load all Merkle log rows from PG in insert order. */
export async function loadMerkleRows(
  db: DbExecutor,
): Promise<LoadedMerkleRow[]> {
  const rows = await db
    .select({
      id: schema.provenanceMerkleLog.id,
      prevEntryId: schema.provenanceMerkleLog.prevEntryId,
      entrySeq: schema.provenanceMerkleLog.entrySeq,
      contentHash: schema.provenanceMerkleLog.contentHash,
      entityKind: schema.provenanceMerkleLog.entityKind,
      entityId: schema.provenanceMerkleLog.entityId,
      signedJws: schema.provenanceMerkleLog.signedJws,
      signerPrincipalId: schema.provenanceMerkleLog.signerPrincipalId,
    })
    .from(schema.provenanceMerkleLog)
    .orderBy(schema.provenanceMerkleLog.entrySeq);

  return rows.map((r) => ({
    id: r.id as EntityId,
    prevEntryId: (r.prevEntryId ?? null) as EntityId | null,
    entrySeq: r.entrySeq,
    contentHash: r.contentHash as ContentHash,
    entityKind: r.entityKind,
    entityId: r.entityId,
    signedJws: r.signedJws as SignedJws,
    signerPrincipalId: r.signerPrincipalId,
  }));
}

/** Load + verify. Returns the report; caller logs / alerts / persists. */
export async function runVerifyMerkleLog(
  db: DbExecutor,
  options: VerifyMerkleLogOptions,
): Promise<MerkleLogReport> {
  const rows = await loadMerkleRows(db);
  return verifyMerkleLog(rows, options);
}
