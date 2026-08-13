import type {MarkputApi} from '@markput/core'

/**
 * The framework-free half of the page seam: everything `page.react.tsx` and `page.vue.ts`
 * would otherwise declare twice.
 */

/** THE editing host. Story decorators can wrap the editor, so the render root is not it. */
export interface Mounted {
	host: HTMLElement
}

export interface Echoed extends Mounted {
	/** The last value the harness echoed back. */
	value: () => string
}

export interface MountedApi extends Mounted {
	api: () => MarkputApi | null
}

export interface EchoOptions {
	/** Initial controlled value; every `onChange` is echoed back into it. */
	value: string
}

/** The part of a composed story the seam reads. */
export interface StoryAnnotations {
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
 */
export function assertEchoable(story: StoryAnnotations, name = 'story'): void {
	if (story.parameters?.plainValue === undefined) return
	throw new Error(
		`mountEcho cannot drive a ${name} with parameters.plainValue: the withPlainValue decorator ` +
			`owns onChange, so the echoed value would never update. Mount it with mount() instead.`
	)
}