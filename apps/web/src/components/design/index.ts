// Design components barrel — token-driven SoT (Design.md §5).
//
// Each component lives in its own file; this barrel re-exports the
// component + its props type so callers can do:
//
//   import { Button, MonoDisc, type ButtonProps } from '@/components/design';
//
// Order follows Design.md §5 (5.1 → 5.8). Default exports are NOT
// re-exported — keep the named-import contract stable.

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { MonoDisc } from './MonoDisc';
export type { MonoDiscProps, MonoDiscKind, MonoDiscSize } from './MonoDisc';

export { StatusPill } from './StatusPill';
export type { StatusPillProps, StatusPillStatus } from './StatusPill';

export { ProvenanceCard } from './ProvenanceCard';
export type {
  ProvenanceCardProps,
  ProvenanceCardToolCall,
} from './ProvenanceCard';

export { CitationPopover } from './CitationPopover';
export type { CitationPopoverProps } from './CitationPopover';

export { BlockHoverRail } from './BlockHoverRail';
export type { BlockHoverRailProps } from './BlockHoverRail';

export { MarginaliaEntry } from './MarginaliaEntry';
export type {
  MarginaliaEntryProps,
  MarginaliaAccent,
} from './MarginaliaEntry';

export { HairlineRule } from './HairlineRule';
export type { HairlineRuleProps, HairlineWeight } from './HairlineRule';

// --- Design.md v2 (warmth + concretization) ------------------------------
export { Icon } from './Icon';
export type { IconProps, IconName, IconSize } from './Icon';

export { LineGlyph } from './LineGlyph';
export type { LineGlyphProps } from './LineGlyph';

export { ProductFrame } from './ProductFrame';
export type { ProductFrameProps } from './ProductFrame';

// --- Design.md v2 form / list / page foundation (Phase 1) -----------------
export { Field } from './Field';
export type { FieldProps } from './Field';

export { TextInput, TextArea, Select } from './FormControls';
export type {
  TextInputProps,
  TextAreaProps,
  SelectProps,
  FormControlTone,
} from './FormControls';

export { HairlineList, ListRow } from './HairlineList';
export type { HairlineListProps, ListRowProps } from './HairlineList';

export { PageShell } from './PageShell';
export type { PageShellProps, PageWidth } from './PageShell';

export { PageHeader, SectionHeader } from './PageHeader';
export type { PageHeaderProps, SectionHeaderProps } from './PageHeader';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
