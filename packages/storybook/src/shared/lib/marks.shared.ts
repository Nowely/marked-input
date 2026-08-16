import type {CSSProperties, MarkInfo, MarkNode} from '@markput/core'

/**
 * The framework-free half of the mark seam: everything `marks.react.tsx` and `marks.vue.ts`
 * would otherwise declare twice.
 */

/**
 * What a computed field of a {@link MarkSpec} is given. Both adapters publish `useMark()` and
 * `useMarkInfo()` returning these exact core types, which is what lets one spec read a hook in
 * either framework — the divergence starts at `useOverlay()`, which this deliberately omits.
 */
export interface MarkContext {
	value?: string
	meta?: string
	/** `useMarkInfo()`: the mark's depth and whether it holds nested marks. */
	info: MarkInfo
	/** `useMark()`: the live node, for the write verbs. */
	mark: MarkNode
}

/** A field that either is a value or is derived from the mark's own context. */
type Computed<T> = T | ((context: MarkContext) => T)

/**
 * One generated mark: the element it IS, its decoration, and one hook on rendering.
 *
 * What goes INSIDE is not a choice. A generated mark renders `children ?? value`: `children` is
 * the nested-token slot in both adapters — react's JSX children, vue's default slot — falling
 * back to the `children` an option's `mark` mapper produced, which is the only other source
 * since `resolveMarkSlot` passes `value` and `meta` and nothing else. A value-only markup gets
 * no slot at all, so the fallback IS the value. A mark that needs to drop one of the two is
 * hand-written on its page.
 */
export interface MarkSpec {
	/**
	 * The element the mark IS. Required: a call site that does not say is a call site that lies.
	 * Computed when the markup's own VALUE names the element.
	 */
	tag: Computed<string>
	class?: string
	/** Merged OVER an incoming `style` prop, which is the order the markdown preset needs. */
	style?: CSSProperties
	/** Written verbatim, so keys are attribute-spelled: `data-custom`, not `dataCustom`. */
	attrs?: Computed<Record<string, string>>
	/** Handlers the element gets. Deliberately click only: nothing here has needed a second. */
	on?: {click?: (context: MarkContext) => void}
	/**
	 * Called once per RENDER INVOCATION. Each seam places the call where that is true for its
	 * framework, which is the whole subject of the render-count gates — see {@link countRenders}
	 * in either seam file. Unset everywhere else.
	 */
	onRender?: () => void
}