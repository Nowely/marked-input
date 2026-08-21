import type {TreeNode} from '@markput/core'
import {cx, renderSubscription} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {BlockMenu} from './BlockMenu'
import {DragHandle} from './DragHandle'
import {DropIndicator} from './DropIndicator'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

// Not exported from core's public index: block layout's only root kind (RowNode), named locally.
export type BlockRow = Extract<TreeNode, {kind: 'row'}>

interface BlockProps {
	node: BlockRow
}

export const Block = memo(({node}: BlockProps) => {
	const {blockStore, Component, slotProps, isDragging, tokens} = useMarkput(s => {
		const blockStore = s.block.get(node)
		return {
			blockStore,
			Component: s.slots.blockComponent,
			slotProps: s.slots.blockProps,
			isDragging: blockStore.state.isDragging,
			tokens: s.tokens,
		}
	})
	// The per-row subscription: a RowNode's children are what this component paints, so a
	// structural edit inside the row must re-render it — `renderSubscription`'s row arm,
	// the same job its mark arm does for Token.
	useMarkput(() => renderSubscription(node))

	// MEMOISED, unlike `setBlockRef` below: `consign` mints a registration key per CALL, so
	// calling it inline would file a fresh entry on every paint and never release the old one.
	// The wrapper IS the row's token element (issue 08) — no separate row registry entry.
	const consignBlock = useMemo(() => tokens.consign(node.id), [tokens, node.id])

	const setBlockRef = (el: HTMLElement | null) => {
		consignBlock(el)
		blockStore.attachContainer(el)
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
			<DropIndicator node={node} position="before" />

			<DragHandle node={node} />

			{node.children().map(child => (
				<Token key={child.id} node={child} depth={0} />
			))}

			<DropIndicator node={node} position="after" />

			<BlockMenu node={node} />
		</Component>
	)
})

Block.displayName = 'Block'