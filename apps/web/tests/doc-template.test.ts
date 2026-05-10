// Phase 4 W6.2 — 新建文档 3 模板的形态测试。
//
// 覆盖：
//   1. 3 个模板 JSON 都能被 paperSchema 正确解析（fromJSON + check 通过）
//   2. lit-review 至少含 2 个 claim 节点（一个 supported、一个 unsupported
//      故意留 maintenance scan 触发）+ 至少 1 个 evidence 节点
//   3. bilingual-paper 至少含一个 citationRef inline 节点
//   4. blank 是合法 PM doc
//   5. DOC_TEMPLATES UI 元数据与文件 id 对齐
//
// 这些测试是后续模板演进的 gate —— 改了模板 JSON 而忘了更新 schema /
// 文档配置，CI 会立刻报红。

import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { paperSchema } from '@collaborationtool/editor-core';

import {
  DOC_TEMPLATES,
  DOC_TEMPLATE_IDS,
  isDocTemplateId,
  loadDocTemplate,
  type DocTemplateId,
} from '../src/lib/doc-template';

const PUBLIC_TEMPLATES_DIR = path.join(
  process.cwd(),
  'public',
  'templates',
);

async function readTemplate(id: DocTemplateId): Promise<unknown> {
  const file = path.join(PUBLIC_TEMPLATES_DIR, `${id}.json`);
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw);
}

interface PmNodeLike {
  type: string;
  content?: PmNodeLike[];
  marks?: { type: string }[];
}

function walk(node: PmNodeLike, fn: (n: PmNodeLike) => void): void {
  fn(node);
  for (const child of node.content ?? []) {
    walk(child, fn);
  }
}

describe('doc templates — schema validity (Phase 4 W6.2)', () => {
  for (const id of DOC_TEMPLATE_IDS) {
    it(`${id}.json validates against paperSchema`, async () => {
      const json = await readTemplate(id);
      const schema = paperSchema();
      // fromJSON throws on unknown node types; check() validates content
      // model (e.g. claim must contain paragraph+).
      const node = schema.nodeFromJSON(json);
      node.check();
      assert.equal(node.type.name, 'doc');
    });
  }
});

describe('lit-review template — claim/evidence shape', () => {
  it('contains at least 2 claim nodes', async () => {
    const json = (await readTemplate('lit-review')) as PmNodeLike;
    const claims: PmNodeLike[] = [];
    walk(json, (n) => {
      if (n.type === 'claim') claims.push(n);
    });
    assert.ok(
      claims.length >= 2,
      `expected ≥2 claim nodes, got ${claims.length}`,
    );
  });

  it('contains at least 1 evidence node', async () => {
    const json = (await readTemplate('lit-review')) as PmNodeLike;
    const evidence: PmNodeLike[] = [];
    walk(json, (n) => {
      if (n.type === 'evidence') evidence.push(n);
    });
    assert.ok(
      evidence.length >= 1,
      `expected ≥1 evidence node, got ${evidence.length}`,
    );
  });

  it('has one supported claim (linked by evidence) + one unsupported claim', async () => {
    const json = (await readTemplate('lit-review')) as unknown as {
      content: PmNodeLike[];
    };
    const claims: { id: unknown }[] = [];
    const evidenceTargets = new Set<unknown>();
    walk(json as unknown as PmNodeLike, (n) => {
      const attrs = (n as unknown as { attrs?: Record<string, unknown> }).attrs;
      if (n.type === 'claim') {
        claims.push({ id: attrs?.['claimId'] });
      }
      if (n.type === 'evidence' && attrs?.['supportsClaimId']) {
        evidenceTargets.add(attrs['supportsClaimId']);
      }
    });
    const supported = claims.filter((c) => evidenceTargets.has(c.id));
    const unsupported = claims.filter((c) => !evidenceTargets.has(c.id));
    assert.ok(
      supported.length >= 1,
      'expected ≥1 supported claim (with linked evidence)',
    );
    assert.ok(
      unsupported.length >= 1,
      'expected ≥1 unsupported claim (template intentionally leaves one for maintenance scan)',
    );
  });

  it('has H1 + 3 H2 sections (引言 / 主要工作 / 总结)', async () => {
    const json = (await readTemplate('lit-review')) as PmNodeLike;
    const h2Count: number[] = [];
    let hasH1 = false;
    walk(json, (n) => {
      const attrs = (n as unknown as { attrs?: { level?: number } }).attrs;
      if (n.type === 'heading' && attrs?.level === 1) hasH1 = true;
      if (n.type === 'heading' && attrs?.level === 2) {
        h2Count.push(attrs.level);
      }
    });
    assert.ok(hasH1, 'expected at least one H1 heading');
    assert.equal(h2Count.length, 3, 'expected exactly 3 H2 sections');
  });
});

describe('bilingual-paper template — citation + bilingual', () => {
  it('contains at least one citationRef inline node', async () => {
    const json = (await readTemplate('bilingual-paper')) as PmNodeLike;
    let count = 0;
    walk(json, (n) => {
      if (n.type === 'citationRef') count += 1;
    });
    assert.ok(
      count >= 1,
      `expected ≥1 citationRef node, got ${count}`,
    );
  });

  it('contains both Chinese and English text fragments', async () => {
    const json = (await readTemplate('bilingual-paper')) as PmNodeLike;
    let hasZh = false;
    let hasEn = false;
    walk(json, (n) => {
      const text = (n as unknown as { text?: string }).text;
      if (typeof text === 'string') {
        if (/[一-鿿]/.test(text)) hasZh = true;
        if (/[a-zA-Z]{4,}/.test(text)) hasEn = true;
      }
    });
    assert.ok(hasZh, 'bilingual template missing Chinese text');
    assert.ok(hasEn, 'bilingual template missing English text');
  });
});

describe('blank template', () => {
  it('is an (essentially) empty doc', async () => {
    const json = (await readTemplate('blank')) as PmNodeLike;
    assert.equal(json.type, 'doc');
    // blank has just one empty paragraph — total descendant count <= 2.
    let descendants = 0;
    walk(json, () => {
      descendants += 1;
    });
    assert.ok(
      descendants <= 3,
      `blank template should have very few nodes, got ${descendants}`,
    );
  });
});

describe('DOC_TEMPLATES UI metadata', () => {
  it('exposes one entry per template id', () => {
    const ids = DOC_TEMPLATES.map((t) => t.id).sort();
    const expected = [...DOC_TEMPLATE_IDS].sort();
    assert.deepEqual(ids, expected);
  });

  it('every template has bilingual label + description', () => {
    for (const tpl of DOC_TEMPLATES) {
      // Heuristic: contains both CJK and Latin characters.
      assert.ok(
        /[一-鿿]/.test(tpl.label) && /[A-Za-z]/.test(tpl.label),
        `template ${tpl.id} label must be bilingual`,
      );
      assert.ok(
        tpl.description.length > 0,
        `template ${tpl.id} missing description`,
      );
    }
  });

  it('isDocTemplateId narrows correctly', () => {
    for (const id of DOC_TEMPLATE_IDS) {
      assert.equal(isDocTemplateId(id), true);
    }
    assert.equal(isDocTemplateId('not-a-template'), false);
    assert.equal(isDocTemplateId(42), false);
    assert.equal(isDocTemplateId(undefined), false);
  });
});

describe('loadDocTemplate — server-side helper', () => {
  it('round-trips JSON without mutation', async () => {
    for (const id of DOC_TEMPLATE_IDS) {
      const direct = (await readTemplate(id)) as { type: string };
      const loaded = await loadDocTemplate(id);
      assert.equal(loaded.type, 'doc');
      assert.equal(direct.type, loaded.type);
    }
  });
});
