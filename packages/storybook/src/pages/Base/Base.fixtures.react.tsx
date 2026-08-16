import type {MarkProps} from '@markput/react'

import {Button} from '../../shared/components/Button'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Base.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */
export const fixtures = {
	Button,
}

/** Spec fixtures: mark components the shared spec mounts through story args. */
export const marks = {
	Todo: ({children}: MarkProps) => (
		<span>
			<input type="checkbox" aria-label="done" />
			{children}
		</span>
	),
}

export const Overlay = () => <span>I'm here!</span>