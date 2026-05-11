// 4 角色分化 — ADR-0020 §2.4.
//
// Roles drive UI surface defaults (which dashboard / landing page a user
// sees first). They are NOT role-based access control — capabilities
// (ADR-0002) remain fine-grained and orthogonal. Users can hold multiple
// roles simultaneously; the platform surfaces a role switcher when so.

export type Role =
  | 'explorer' // 夜科学家 — 模式 A/C/E 重，产 Night artifact
  | 'bridge-builder' // 桥接者 — 模式 D + 交互 4/6 重，产 Bridge artifact
  | 'validator' // 日科学家 — 模式 B 重，产 Day artifact + 跑 review
  | 'connector'; // broker / 边界物设计者 — Burt structural hole spanner

export const ROLES: readonly Role[] = [
  'explorer',
  'bridge-builder',
  'validator',
  'connector',
] as const;

const ROLE_SET: ReadonlySet<string> = new Set<string>(ROLES);

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_SET.has(value);
}

export function parseRole(value: string): Role | null {
  return isRole(value) ? value : null;
}

// Default landing surface per role. Wave D-4 will wire these paths.
// Users can switch surfaces at any time; the role choice is a hint,
// not a lock.
export const DEFAULT_SURFACE_BY_ROLE: Record<Role, string> = {
  explorer: '/discover',
  'bridge-builder': '/translate',
  validator: '/manuscript',
  connector: '/network',
};

export const ROLE_LABELS_ZH: Record<Role, string> = {
  explorer: '探索者',
  'bridge-builder': '桥接者',
  validator: '验证者',
  connector: '连接者',
};

export const ROLE_LABELS_EN: Record<Role, string> = {
  explorer: 'Explorer',
  'bridge-builder': 'Bridge-builder',
  validator: 'Validator',
  connector: 'Connector',
};
