import type {TreeNode} from '@markput/core'
import {cx} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {BlockMenu} from './BlockMenu'
import {DragHandle} from './DragHandle'
import {DropIndicator} from './DropIndicator'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

interface BlockProps {
	node: TreeNode
	blockIndex: number
}

export const Block = memo(({node, blockIndex}: BlockProps) => {
	const {blockStore, action, Component, slotProps, isDragging, tokens} = useMarkput(s => {
		const blockStore = s.block.get(node)
		return {
			blockStore,
			action: s.block.action,
			Component: s.slots.blockComponent,
			slotProps: s.slots.blockProps,
			isDragging: blockStore.state.isDragging,
			tokens: s.tokens,
		}
	})

	// MEMOISED, unlike `setBlockRef` below: `consignRow` mints a registration key per CALL, so
	// calling it inline would file a fresh entry on every paint and never release the old one.
	const consignRow = useMemo(() => tokens.consignRow(node.id), [tokens, node.id])

	const setBlockRef = (el: HTMLElement | null) => {
		consignRow(el)
		blockStore.attachContainer(el, blockIndex, {action})
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

			<DragHandle node={node} blockIndex={blockIndex} />

			<Token node={node} depth={0} />

			<DropIndicator node={node} position="after" />

			<BlockMenu node={node} />
		</Component>
	)
})

Block.displayName = 'Block'