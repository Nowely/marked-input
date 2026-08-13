import type {MarkProps} from '@markput/react'
import {useMark} from '@markput/react'

import {Button} from '../../shared/components/Button'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Base.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */
export const fixtures = {
	Alerting: (props: MarkProps) => <mark onClick={_ => alert(props.meta)}>{props.value}</mark>,
	Button,
	/** React takes `onKeyDown`; Vue takes `onKeydown`. The other four are named identically. */
	containerSlotProps: {
		onKeyDown: () => console.log('onKeyDown'),
	},
	plainValue: 'bottom',
}

/** Spec fixtures: mark components the shared spec mounts through story args. */
export const marks = {
	Value: ({value}: MarkProps) => <mark>{value}</mark>,
	Testid: ({value}: MarkProps) => <mark data-testid="mark">{value}</mark>,
	Children: ({children}: MarkProps) => <mark data-testid="mark">{children}</mark>,
	Todo: ({children}: MarkProps) => (
		<span data-testid="todo-mark">
			<input type="checkbox" aria-label="done" />
			{children}
		</span>
	),
	Focusable: () => {
		const mark = useMark()
		return (
			<abbr title={mark.meta()} style={{outline: 'none', whiteSpace: 'pre-wrap'}}>
				{mark.value()}
			</abbr>
		)
	},
	Removable: () => {
		const mark = useMark()
		return <mark onClick={() => mark.remove()}>{mark.value()}</mark>
	},
	Updatable: () => {
		const mark = useMark()
		return <mark onClick={() => mark.update({value: `${mark.value()}1`})}>{mark.value()}</mark>
	},
	Empty: () => null,
}

export const Overlay = () => <span>I'm here!</span>