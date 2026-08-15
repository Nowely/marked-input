import type {MarkProps} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {useState} from 'react'

import {defineMark} from '../../shared/lib/marks'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Clipboard.stories.ts` is the contract, and it fails to compile under either
 * project if this file drifts.
 */

const Mark = defineMark({tag: 'mark'})

/** Nested HTML inside the mark element, so one mark holds MORE than one text node. */
const NestedMark = ({value = ''}: MarkProps) => {
	const mid = Math.ceil(value.length / 2)
	return (
		<mark>
			<strong>{value.slice(0, mid)}</strong>
			<em>{value.slice(mid)}</em>
		</mark>
	)
}

/** The `PlainText` story's harness: a controlled editor whose value starts markless. */
function PlainTextInput() {
	const [value, setValue] = useState('abc')
	return <MarkedInput Mark={Mark} value={value} onChange={setValue} />
}

export const fixtures = {
	Mark,
	NestedMark,
	renderPlainText: () => <PlainTextInput />,
}