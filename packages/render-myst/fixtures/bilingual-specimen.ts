// PM JSON fixture used by all render-myst tests.
// Mirrors proto-b's specimen: heading, bilingual paragraph, citation,
// inline + display math, code block.

export const bilingualSpecimen = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: '协作论文平台 / Collaboration Tool' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '我们用GPT写论文。' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'See ' },
        {
          type: 'citationRef',
          attrs: {
            blockId: 'blk-cite-1',
            citationId: 'cite-doi-10.1145-3531146.3533104',
            label: 'Bommasani 2022',
          },
        },
        { type: 'text', text: ' for the foundation models taxonomy.' },
      ],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '损失函数 ' },
        {
          type: 'inlineEquation',
          attrs: { blockId: 'blk-ie-1', latex: '\\mathcal{L} = -\\sum_i \\log p_i' },
        },
        { type: 'text', text: ' 在训练时最小化。' },
      ],
    },
    {
      type: 'equation',
      attrs: { blockId: 'blk-eq-1', latex: '\\rho(t) = \\frac{1}{Z} e^{-\\beta H(t)}' },
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [{ type: 'bold' }],
          text: 'Bold mixed: ',
        },
        { type: 'text', text: '中文 with ' },
        {
          type: 'text',
          marks: [{ type: 'italic' }],
          text: 'italic English',
        },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'computationalCell',
      attrs: {
        blockId: 'blk-cc-1',
        cellId: 'cell-1',
        kernel: 'molab',
        sourceCode: 'import numpy as np\nx = np.linspace(0, 1, 100)',
      },
    },
  ],
};
