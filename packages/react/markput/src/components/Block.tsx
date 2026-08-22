import type {TreeNode} from '@markput/core'
import {cx, renderSubscription} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

// Not exported from core's public index: block layout's only root kind (RowNode), named locally.
export type BlockRow = Extract<TreeNode, {kind: 'row'}>

interface BlockProps {
	node: BlockRow
}

/**
 * A row's wrapper and its children — nothing else. The grip, the drop indicators and the menu
 * that used to be painted here live in the editor's one `ChromeLayer`, so a row is no longer a
 * mixture of document content and chrome.
 */
export const Block = memo(({node}: BlockProps) => {
	const {Component, slotProps, tokens} = useMarkput(s => ({
		Component: s.slots.blockComponent,
		slotProps: s.slots.blockProps,
		tokens: s.tokens,
	}))
	// A SCALAR subscription, deliberately not a field on the object selector above. The object
	// form rebuilds a fresh snapshot whenever any of its sources fires, so reading the editor's
	// one `dragging` signal there would re-render EVERY row the moment any row is picked up —
	// the exact regression an editor-level chrome signal invites. As a boolean it notifies only
	// when THIS row's own answer flips. The closure is safe for `Token`'s reason: the component
	// is keyed by `node.id` and ids are never reused.
	const isDragging = useMarkput(s => () => s.chrome.state.dragging() === node.id)
	// The per-row subscription: a RowNode's children are what this component paints, so a
	// structural edit inside the row must re-render it — `renderSubscription`'s row arm,
	// the same job its mark arm does for Token.
	useMarkput(() => renderSubscription(node))

	// MEMOISED, unlike `setBlockRef` below: `consign` and `children` mint a registration key per
	// CALL, so calling them inline would file a fresh entry on every paint and never release the
	// old one. The wrapper IS the row's token element (issue 08) AND its child-sequence host, so
	// the row's children hang off it directly.
	const consignBlock = useMemo(() => tokens.consign(node.id), [tokens, node.id])
	const hostBlock = useMemo(() => tokens.children(node.id), [tokens, node.id])

	const setBlockRef = (el: HTMLElement | null) => {
		consignBlock(el)
		hostBlock(el)
	}

	return (
		<Component
			ref={setBlockRef}
			{...slotProps}
			// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.className is raw and needs casting to string
			className={cx(styles.Block, slotProps?.className as string | undefined)}
			// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.style is raw and needs casting to CSSProperties
			style={{opacity: isDragging ? 0.4 : 1, ...(slotProps?.style as CSSProperties | undefined)}}
		>
			{node.children().map(child => (
				<Token key={child.id} node={child} depth={0} />
			))}
		</Component>
	)
})

Block.displayName = 'Block'