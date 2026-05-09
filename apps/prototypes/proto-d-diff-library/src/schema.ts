import { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";

// Minimal schema sized to the 3.3 question. We don't need the full paper
// schema; just enough block + inline structure to surface where each diff
// library breaks down.
//   - paragraph + heading: block-level granularity questions
//   - cite_inline mark:    semantic span the text-level diff loses
//   - text + bold:         baseline inline edits
export const spikeSchema = new Schema({
  nodes: basicSchema.spec.nodes,
  marks: basicSchema.spec.marks.append({
    cite_inline: {
      attrs: { citationKey: { default: "" } },
      inclusive: false,
      parseDOM: [{ tag: "span.cite", getAttrs: (el) => ({ citationKey: (el as HTMLElement).getAttribute("data-key") ?? "" }) }],
      toDOM: (mark) => ["span", { class: "cite", "data-key": (mark.attrs as { citationKey: string }).citationKey }, 0],
    },
  }),
});
