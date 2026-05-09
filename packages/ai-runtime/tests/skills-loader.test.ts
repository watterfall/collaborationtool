import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, before, after } from 'node:test';

import {
  SkillLoadError,
  _resetSkillCache,
  loadSkill,
} from '../src/skills-loader';

describe('loadSkill', () => {
  let root: string;

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'collab-skills-'));
    _resetSkillCache();

    // Build a fixture skill
    await writeFile(
      join(root, 'demo', 'SKILL.md').replace(/\/SKILL\.md$/, '/SKILL.md'),
      '',
    ).catch(() => {});
    const skillDir = join(root, 'demo');
    await import('node:fs/promises').then((fs) => fs.mkdir(skillDir, { recursive: true }));
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---
name: demo
description: A demo skill for tests
allowed_mcp_servers:
  - crossref
  - arxiv
required_capabilities:
  - block.read
  - block.propose
---

# Demo

Body content goes here.
`,
    );

    // Malformed
    const badDir = join(root, 'bad');
    await import('node:fs/promises').then((fs) => fs.mkdir(badDir, { recursive: true }));
    await writeFile(join(badDir, 'SKILL.md'), 'no frontmatter\nbody\n');
  });

  after(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('parses frontmatter + computes promptHash', async () => {
    const meta = await loadSkill(root, 'demo', { noCache: true });
    assert.equal(meta.skillId, 'demo');
    assert.equal(meta.name, 'demo');
    assert.equal(meta.description, 'A demo skill for tests');
    assert.deepEqual(meta.allowedMcpServers, ['crossref', 'arxiv']);
    assert.deepEqual(meta.requiredCapabilities, ['block.read', 'block.propose']);
    assert.match(meta.promptHash, /^[0-9a-f]{64}$/);
    assert.match(meta.promptTemplateId, /^demo@[0-9a-f]{12}$/);
    // The body has a leading newline because frontmatter's trailing
    // `---\n` consumes one but the body retains the rest.
    assert.match(meta.bodyMarkdown, /# Demo/);
  });

  it('caches across calls with same path + mtime', async () => {
    _resetSkillCache();
    const a = await loadSkill(root, 'demo');
    const b = await loadSkill(root, 'demo');
    // Object reference identity confirms cache hit.
    assert.equal(a, b);
  });

  it('throws SkillLoadError on missing skill', async () => {
    await assert.rejects(
      () => loadSkill(root, 'no-such', { noCache: true }),
      (err: unknown) => {
        assert.ok(err instanceof SkillLoadError);
        assert.equal(err.skillId, 'no-such');
        assert.equal(err.cause_, 'not-found');
        return true;
      },
    );
  });

  it('throws SkillLoadError on malformed frontmatter', async () => {
    await assert.rejects(
      () => loadSkill(root, 'bad', { noCache: true }),
      (err: unknown) => {
        assert.ok(err instanceof SkillLoadError);
        assert.equal(err.cause_, 'malformed');
        return true;
      },
    );
  });
});
