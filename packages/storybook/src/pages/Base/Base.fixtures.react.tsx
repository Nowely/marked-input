import type {MarkProps} from '@markput/react'
import {MarkedInput, useMark} from '@markput/react'
import {useState} from 'react'

import {Button} from '../../shared/components/Button'
import {Mark} from '../../shared/lib/marks'

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
}

/** Spec fixtures: mark components the shared spec mounts through story args. */
export const marks = {
	Todo: ({children}: MarkProps) => (
		<span>
			<input type="checkbox" aria-label="done" />
			{children}
		</span>
	),
	Updatable: () => {
		const mark = useMark()
		return <mark onClick={() => mark.update({value: `${mark.value()}1`})}>{mark.value()}</mark>
	},
}

export const Overlay = () => <span>I'm here!</span>

/**
 * A harness whose `readOnly` prop DISAPPEARS rather than turning false — the shape a tabbed
 * story has, and the one that used to leave the editor read-only for good.
 */
export const DroppedReadOnly = () => {
	const [locked, setLocked] = useState(true)

	return (
		<>
			<button onClick={() => setLocked(false)}>unlock</button>
			{locked ? (
				<MarkedInput Mark={Mark} defaultValue="hello @[x](1)" readOnly={true} />
			) : (
				<MarkedInput Mark={Mark} defaultValue="hello @[x](1)" />
			)}
		</>
	)
}