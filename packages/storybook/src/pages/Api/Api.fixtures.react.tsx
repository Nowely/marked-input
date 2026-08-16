import type {MarkNode, MarkputApi, Markup, Option, TextNode} from '@markput/react'
import {MarkedInput} from '@markput/react'
import {useRef, useState} from 'react'

import {Mark} from '../../shared/lib/marks'
import type {PageArgs} from '../../shared/lib/stories'

/**
 * Story fixtures: the framework half of this page's stories. There is no shared interface to
 * `satisfies` — `Api.stories.ts` is the contract, and it fails to compile under either project
 * if this file drifts.
 */

const MARKUP = '@[__value__](__meta__)' as Markup

const OPTIONS: Option[] = [{markup: MARKUP}]

/**
 * US-5 driven entirely through the §2.3 host object: every button is a `MarkputApi` verb
 * over node anchors, with no global offsets anywhere.
 */
function Playground({layout, defaultValue}: PageArgs) {
	const api = useRef<MarkputApi>(null)
	const [value, setValue] = useState(defaultValue)

	const nodes = (): readonly (MarkNode | TextNode)[] => api.current?.nodes() ?? []

	const textAt = (index: number): TextNode => {
		const node = nodes()[index]
		if (node.kind !== 'text') throw new Error(`expected a text node at ${index}`)
		return node
	}

	const markAt = (index: number): MarkNode => {
		const node = nodes()[index]
		if (node.kind !== 'mark') throw new Error(`expected a mark node at ${index}`)
		return node
	}

	return (
		<div>
			<MarkedInput
				ref={api}
				layout={layout}
				defaultValue={defaultValue}
				onChange={setValue}
				Mark={Mark}
				options={OPTIONS}
			/>
			<div>
				{/*
				 * `onMouseDown` + preventDefault is REQUIRED, not decoration: the selection
				 * controller clears its stored anchors on `focusout`, so a toolbar button that
				 * takes focus makes `insertMark('caret')` reject every time. It is the standard
				 * toolbar pattern and the only way §2.3's `'caret'` verb is usable from UI
				 * outside the editor.
				 */}
				<button
					type="button"
					onMouseDown={e => e.preventDefault()}
					onClick={() => api.current?.insertMark('caret', {markup: MARKUP, value: 'carol', meta: 'u3'})}
				>
					insert at caret
				</button>
				<button type="button" onClick={() => markAt(1).update({meta: 'edited'})}>
					edit meta
				</button>
				<button type="button" onClick={() => markAt(1).update({meta: null})}>
					clear meta
				</button>
				<button type="button" onClick={() => markAt(1).remove()}>
					remove mark
				</button>
				<button
					type="button"
					onClick={() => api.current?.replaceText({node: textAt(0), start: 0, end: 5}, 'Howdy')}
				>
					replace span
				</button>
				<button
					type="button"
					onClick={() =>
						api.current?.replaceRange({node: textAt(0), offset: 6}, {after: markAt(1)}, 'nobody')
					}
				>
					replace across
				</button>
				<button type="button" onClick={() => api.current?.setValue('reset @[all](u9)')}>
					set value
				</button>
				{/* `input.clear()` is not a second verb — §2.3 defines it AS setValue('') (plan decision D-e). */}
				<button type="button" onClick={() => api.current?.setValue('')}>
					clear value
				</button>
				<button
					type="button"
					onClick={() =>
						api.current?.insertMark({after: markAt(0)}, {markup: MARKUP, value: 'row', meta: 'r'})
					}
				>
					insert between rows
				</button>
			</div>
			<output aria-label="value">{value}</output>
		</div>
	)
}

export const fixtures = {
	renderPlayground: (args: PageArgs) => <Playground {...args} />,
}