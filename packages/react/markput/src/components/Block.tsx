import type {Token as TokenType} from '@markput/core'
import type {ElementType} from 'react'
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

	// oxlint-disable-next-line no-unsafe-type-assertion -- Slot returns [unknown, ...] in core; React-specific type asserted here
	const [ContainerComponent, containerProps] = useMarkput(s => s.computed.block) as readonly [
		ElementType,
		Record<string, unknown> | undefined,
	]
	const isDragging = useMarkput(() => blockStore.state.isDragging)

	return (
		<ContainerComponent
			ref={(el: HTMLElement | null) => blockStore.attachContainer(el, blockIndex, store.event)}
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