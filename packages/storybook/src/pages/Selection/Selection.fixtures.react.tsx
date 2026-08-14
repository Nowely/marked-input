import type {MarkProps} from '@markput/react'
import type {ReactNode} from 'react'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Selection.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */
export const fixtures = {
	Value: ({value}: MarkProps) => <mark>{value}</mark>,
}

/** Spec fixture: the adapter-owned text surface the cross-select spec configures. */
export const Span = ({children}: {children?: ReactNode}) => <strong>{children}</strong>