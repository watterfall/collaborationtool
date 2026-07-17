// /vault — 本地文库 surface（Wave A1，improvement-plan-2026-08）。
//
// Desktop-only：真正的门在 client 侧 isTauri()（浏览器里所有 bridge 调用
// 降级为 null）。网页版渲染诚实的 desktop-only 说明，不假装可用
// （与 sandbox 占位同一"公开披露式"原则）。

import { getDict } from '@/lib/i18n/get-locale';

import VaultClient from './vault-client';

export default async function VaultPage() {
  const { t } = await getDict();
  return <VaultClient copy={t.vault} />;
}
