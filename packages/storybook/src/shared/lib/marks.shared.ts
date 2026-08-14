import type {CSSProperties} from '@markput/core'

/**
 * The framework-free half of the mark seam: everything `marks.react.tsx` and `marks.vue.ts`
 * would otherwise declare twice.
 */

/**
 * What a generated mark puts inside its element. `children` is the nested-token slot in both
 * adapters — react's JSX children, vue's default slot — falling back to the `children` an
 * option's `mark` mapper produced, which is the only other source: `resolveMarkSlot` passes
 * `value` and `meta` and nothing else. `childrenOrValue` is for a mark that has to serve both
 * a `__slot__` and a `__value__` markup: a value-only markup gets no slot at all.
 */
export type MarkContent = 'value' | 'children' | 'childrenOrValue'

/** One generated mark: the element it IS, what goes inside it, and its static decoration. */
export interface MarkSpec {
	/** The element the mark IS. Required: a call site that does not say is a call site that lies. */
	tag: string
	content: MarkContent
	class?: string
	/** Merged OVER an incoming `style` prop, which is the order the markdown preset needs. */
	style?: CSSProperties
	/** Written verbatim, so keys are attribute-spelled: `data-testid`, not `dataTestId`. */
	attrs?: Record<string, string>
}