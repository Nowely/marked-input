import type {Token as TokenType} from '@markput/core'
import {cx} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {BlockMenu} from './BlockMenu'
import {DragHandle} from './DragHandle'
import {DropIndicator} from './DropIndicator'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

interface BlockProps {
	token: TokenType
	blockIndex: number
}

export const Block = memo(({token, blockIndex}: BlockProps) => {
	const {blockStore, action, Component, slotProps, isDragging} = useMarkput(s => {
		const blockStore = s.block.get(token)
		return {
			blockStore,
			action: s.block.action,
			Component: s.slots.blockComponent,
			slotProps: s.slots.blockProps,
			isDragging: blockStore.state.isDragging,
		}
	})

	const setBlockRef = (el: HTMLElement | null) => {
		blockStore.attachContainer(el, blockIndex, {action})
	}

	return (
		<Component
			ref={setBlockRef}
			data-testid="block"
			{...slotProps}
			// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.className is raw and needs casting to string
			className={cx(styles.Block, slotProps?.className as string | undefined)}
			// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.style is raw and needs casting to CSSProperties
			style={{opacity: isDragging ? 0.4 : 1, ...(slotProps?.style as CSSProperties | undefined)}}
		>
			<DropIndicator token={token} blockIndex={blockIndex} position="before" />

			<DragHandle token={token} blockIndex={blockIndex} />

			<Token token={token} path={[blockIndex]} />

			<DropIndicator token={token} blockIndex={blockIndex} position="after" />

			<BlockMenu token={token} blockIndex={blockIndex} />
		</Component>
	)
})

Block.displayName = 'Block'