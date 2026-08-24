import {useMarkput, useOverlay} from '@markput/react'

import styles from './notion.module.css'

/**
 * The `/` block menu.
 *
 * Every item writes plain markdown text, not a chosen markup: the overlay's own `select()`
 * inserts the markup of the option that carries the TRIGGER
 * (`packages/core/src/features/overlay/OverlayController.ts:169-176`), and one option carries
 * one markup, so a menu that offers nine block kinds cannot express any of them through it.
 * What it can reach is the same write path `select()` uses — `store.edit.replace` over the
 * trigger's own range — so that is what these items call.
 */
const ITEMS = [
	{label: 'Heading 1', hint: 'Big section heading', text: '# '},
	{label: 'Heading 2', hint: 'Medium section heading', text: '## '},
	{label: 'Heading 3', hint: 'Small section heading', text: '### '},
	{label: 'Bulleted list', hint: 'A simple list', text: '- '},
	{label: 'Quote', hint: 'Capture a quote', text: '> '},
	{label: 'Code', hint: 'Fenced code block', text: '```\n```'},
	{label: 'Table', hint: 'Rows and columns', text: '| Column | Column |\n| --- | --- |\n|  |  |'},
]

export const SlashMenu = () => {
	const {match, style, close, ref} = useOverlay()
	// Wrapped in an object literal, not `s => s.edit`: a selector must answer a signal or a
	// `Record<string, …>`, and a controller instance satisfies neither (notion-like issue 10).
	const {edit} = useMarkput(s => ({edit: s.edit}))
	const query = match?.value.toLowerCase() ?? ''
	const items = ITEMS.filter(item => item.label.toLowerCase().includes(query))

	if (!match || items.length === 0) return null

	return (
		<div
			className={styles.overlay}
			style={{position: 'absolute', ...style}}
			ref={element => {
				ref.current = element
			}}
		>
			{items.map(item => (
				<button
					key={item.label}
					type="button"
					className={styles.overlayItem}
					onMouseDown={event => event.preventDefault()}
					onClick={() => {
						edit.replace(match.range.anchor, match.range.head, item.text)
						close()
					}}
				>
					<span className={styles.itemLabel}>{item.label}</span>
					<span className={styles.itemHint}>{item.hint}</span>
				</button>
			))}
		</div>
	)
}