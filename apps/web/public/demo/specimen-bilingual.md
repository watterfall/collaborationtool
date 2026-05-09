# 协作论文平台 / Collaboration Tool

*Abstract:* We present a Phase 1 paper authoring platform that treats the document as a heterogeneous content graph rather than a flat token stream. Y.Doc (CRDT) holds the editable tree; Postgres holds the citation graph and provenance chain. The editor pairs human authors with AI agents — Citation Agent and Inline Editor Agent — under a capability-based access model.

*摘要：* 本文介绍了 Phase 1 的协作论文平台原型，把文档建模为异构内容图：Y.Doc CRDT 承载可编辑树，Postgres 承载引用图与来源链。编辑器把人作者与 AI agent 放在同一权限模型里管理。

## 1. Introduction · 引言

We follow the foundation-models taxonomy from {cite}`10.1145/3531146.3533104` and the Yjs CRDT design from {cite}`10.48550/arXiv.2310.06770`。开放评审场景的可信度问题参照 {cite}`10.1126/science.abe6396`。中文学术出版协作工具相关讨论可参 {cite}`10.7717/peerj-cs.2024-zh`。

The 损失函数 $\mathcal{L} = -\sum_i \log p_\theta(y_i \mid x_i)$ is minimised over a reference dataset {cite}`10.5281/zenodo.10000001`.

$$
\rho(t) = \frac{1}{Z(\beta)} \exp\bigl(-\beta H(t)\bigr)
$$

## 2. Method · 方法

We adopt a hybrid Yjs (CRDT) + Postgres model：tree edits live in Y.Doc; citation, provenance, capability rows persist in Postgres. AI agents are first-class principals (kind='agent') and acquire capabilities through the same grant model as humans.

```python
import numpy as np

# minimum reproducible example
def energy(t, beta=1.0):
    return -np.log(np.exp(-beta * t).sum())

print(energy(np.linspace(0, 1, 100)))
```

We benchmark against the BibTeX-derived dataset described in {cite}`10.1145/3531146.3533104`。Phase 1 D15 验收要求双语样张完整跑通 4 个导出格式（HTML / Word / JATS / PDF）。

```{figure} /demo/figure-architecture.svg
:name: fig-arch

图 1 / Figure 1: Phase 1 architecture — Y.Doc tree on the left, Postgres graph on the right, gateway capability shim in the middle.
```

## 3. Discussion · 讨论

**Trade-offs.** 网关连接级鉴权简化了 Phase 1 的实现，但章节级隔离推迟到 Phase 3 子文档拆分。Provenance *agentContext* 字段（modelId / promptHash / inputSkillIds / toolCalls[]）确保 AI 的每一次介入都可审计，符合系统提示词第一性原理 #11。

**Limitations.** Phase 1 不实施开放评审 / fork-merge UI / 客户端 BYO 模型 — these belong to Phase 3+. The two-author MVP path covered by this specimen is what Phase 1 commits to ship.
