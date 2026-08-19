import type {MarkputHandle} from '@markput/core'

/**
 * The framework-free half of the page seam: everything `page.react.tsx` and `page.vue.ts`
 * would otherwise declare twice.
 */

/** THE editing host. Story decorators can wrap the editor, so the render root is not it. */
export interface Mounted {
	host: HTMLElement
}

/**
 * A mount that can be re-rendered with a WHOLE new arg bag, so a prop the caller stops passing
 * actually disappears rather than keeping its last value. Returns the editing host afresh: a
 * re-render may or may not patch the same element, and no spec should have to know which.
 */
export interface Remountable extends Mounted {
	rerender: (args: Record<string, unknown>) => Promise<HTMLElement>
}

export interface Echoed extends Mounted {
	/** The last value the harness echoed back. */
	value: () => string
}

export interface MountedHandle extends Mounted {
	handle: () => MarkputHandle | null
}

export interface EchoOptions {
	/** Initial controlled value; every `onChange` is echoed back into it. */
	value: string
}

/** The part of a composed story the seam reads. */
export interface StoryAnnotations {
	args?: Record<string, unknown>
	parameters?: {plainValue?: unknown}
}

/**
 * `withPlainValue` replaces the story's `onChange` with its own panel wiring, so a story that
 * opts into the panel can never echo back to the caller: `value()` would sit at its initial
 * string while the assertions read as if the edit had landed. Fail loudly instead.
 *
 * Deliberately wider than the hazard: the decorator only hijacks `onChange` for a CONTROLLED
 * story whose position narrows to 'right' | 'bottom', but a story that opts into the panel at
 * all has no business being driven by the harness.
 *
 * It also covers the second reason `mountEcho` mounts the component rather than the story:
 * decorators do not run there, so a story that needs one cannot be echoed.
 */
export function assertEchoable(story: StoryAnnotations, name = 'story'): void {
	if (story.parameters?.plainValue === undefined) return
	throw new Error(
		`mountEcho cannot drive a ${name} with parameters.plainValue: the withPlainValue decorator ` +
			`owns onChange, so the echoed value would never update. Mount it with mount() instead.`
	)
}