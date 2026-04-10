import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

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
	const [ContainerComponent, containerProps] = store.slot.block.use()

	const blockStore = store.blocks.get(token)
	const isDragging = blockStore.state.isDragging.use()

	return (
		<ContainerComponent
			ref={(el: HTMLElement | null) => blockStore.attachContainer(el, blockIndex, store.events)}
			data-testid="block"
			{...containerProps}
			className={styles.Block}
			style={{opacity: isDragging ? 0.4 : 1}}
		>
			<DropIndicator token={token} position="before" />

			<DragHandle token={token} blockIndex={blockIndex} />

			<Token mark={token} />

			<DropIndicator token={token} position="after" />

			<BlockMenu token={token} />
		</ContainerComponent>
	)
})

Block.displayName = 'Block'