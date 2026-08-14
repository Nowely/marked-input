import type {MarkNode, MarkProps, MarkputApi, Markup, TextNode} from '@markput/react'
import {MarkedInput} from '@markput/react'
import type {Meta, StoryObj} from '@storybook/react-vite'
import {useRef, useState} from 'react'

const MARKUP: Markup = '@[__value__](__meta__)'

const Mark = ({value}: MarkProps) => <mark>{value}</mark>

/**
 * US-5 driven entirely through the §2.3 host object: every button is a `MarkputApi` verb
 * over node anchors, with no global offsets anywhere.
 */
const Playground = ({layout, initial}: {layout: 'inline' | 'block'; initial: string}) => {
	const api = useRef<MarkputApi>(null)
	const [value, setValue] = useState(initial)

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
				defaultValue={initial}
				onChange={setValue}
				Mark={Mark}
				options={[{markup: MARKUP}]}
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

export default {
	title: 'Api',
	component: Playground,
} satisfies Meta<typeof Playground>

type Story = StoryObj<typeof Playground>

export const Default: Story = {args: {layout: 'inline', initial: 'hello @[world](u1) foo'}}

// Block ROWS are top-level TOKENS, not newline-separated lines: two marks are two rows,
// and `'first row\nsecond row'` would be ONE text row — which is why the between-rows
// scenario needs this fixture and not a multi-line string.
export const Block: Story = {args: {layout: 'block', initial: '@[a](x)@[b](y)'}}