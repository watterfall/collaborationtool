// Phase 4 W6.5 — pure helpers for ShareDialog email fallback UI.
//
// Why this exists:
//   `.brainstorm/role-user.md §2` —— B 的助理装完平台后没配
//   MAIL_WEBHOOK_URL，邀请链接只打到 server stderr，普通用户够不着。
//   ShareDialog 在 `email.backend !== 'webhook'` 时必须把 acceptUrl
//   显式渲染 + 一键复制 + 中英双语提示，让 self-host 部署不卡这一步。
//
// Mailer.sendEmail 当前返回 backend = 'webhook' | 'console'。从 UI 视角
// 任何"非 webhook"都视为 fallback；保留 'console-fallback' / 未来扩展
// 的命名空间，统一走 `isFallbackBackend`。

export type MailBackendTag = 'webhook' | 'console' | 'console-fallback' | string;

export function isFallbackBackend(backend: MailBackendTag | undefined): boolean {
  if (!backend) return true;
  return backend !== 'webhook';
}

export interface ShareDialogStatusCopy {
  /** Short bilingual headline shown in the success banner. */
  headline: string;
  /** Longer bilingual body text — explains what happened + next step. */
  body: string;
  /** Tone for styling (emerald = success delivered; amber = needs manual action). */
  tone: 'emerald' | 'amber';
  /** Whether the UI must surface the acceptUrl + copy button prominently. */
  showCopyAffordance: boolean;
}

/**
 * Produce bilingual copy for the post-submit banner.
 *
 * - webhook  → 邮件已发出（绿色），但仍提供"复制链接"以便 owner 自己留底
 * - 其它    → 邮件后端未配置（琥珀色），acceptUrl 必须明显显示 + 一键复制
 */
export function shareDialogStatusCopy(
  backend: MailBackendTag | undefined,
): ShareDialogStatusCopy {
  if (isFallbackBackend(backend)) {
    return {
      headline: '邮件服务未配置 / Mail backend not configured',
      body: '请把下面的邀请链接手动发送给受邀人。 / Copy the invitation link below and send it to the invitee manually.',
      tone: 'amber',
      showCopyAffordance: true,
    };
  }
  return {
    headline: '邀请已发送 / Invitation sent',
    body: '已经把邀请邮件发给受邀人；你也可以复制下面的链接备用。 / The invitation email has been sent; you can copy the link below as a backup.',
    tone: 'emerald',
    showCopyAffordance: true,
  };
}

export interface CopyButtonLabel {
  idle: string;
  copying: string;
  copied: string;
  failed: string;
}

export const COPY_BUTTON_LABEL: CopyButtonLabel = {
  idle: '复制邀请链接 / Copy link',
  copying: '复制中… / Copying…',
  copied: '已复制 ✓ / Copied',
  failed: '复制失败，请手动选择链接 / Copy failed, select link manually',
};

/**
 * Best-effort clipboard write. Returns true on success.
 *
 * Wrapped here (not inlined into ShareDialog) so the test can stub it
 * without touching the React component, and so we can swap to
 * `document.execCommand('copy')` fallback if a browser drops async
 * clipboard support without a flag.
 */
export async function copyTextToClipboard(
  text: string,
  clipboard: { writeText: (s: string) => Promise<void> } | undefined = typeof navigator !==
    'undefined'
    ? navigator.clipboard
    : undefined,
): Promise<boolean> {
  if (!clipboard || typeof clipboard.writeText !== 'function') return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
