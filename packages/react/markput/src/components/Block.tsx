import type {Token as TokenType} from '@markput/core'
import type {CSSProperties, ElementType} from 'react'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
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
	const store = useStore()
	const blockStore = store.blocks.get(token)

	// oxlint-disable-next-line no-unsafe-type-assertion -- blockComponent returns unknown in core; React ElementType asserted here
	const Component = useMarkput(s => s.computed.blockComponent) as ElementType
	const slotProps = useMarkput(s => s.computed.blockProps)
	const isDragging = useMarkput(() => blockStore.state.isDragging)

	return (
		<Component
			ref={(el: HTMLElement | null) => blockStore.attachContainer(el, blockIndex, store.event)}
			data-testid="block"
			{...slotProps}
			className={styles.Block}
			// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.style is raw and needs casting to CSSProperties
			style={{opacity: isDragging ? 0.4 : 1, ...(slotProps?.style as CSSProperties | undefined)}}
		>
			<DropIndicator token={token} position="before" />

			<DragHandle token={token} blockIndex={blockIndex} />

			<Token mark={token} />

			<DropIndicator token={token} position="after" />

			<BlockMenu token={token} />
		</Component>
	)
})

Block.displayName = 'Block'