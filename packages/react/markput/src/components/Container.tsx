import {resolveSlot, resolveSlotProps} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import type {ElementType} from 'react'
import {memo, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {BlockMenu} from './BlockMenu'
import {DragHandle} from './DragHandle'
import {DropIndicator} from './DropIndicator'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

interface ContainerProps {
	tokens: TokenType[]
	blockIndex: number
}

export const Container = memo(({tokens, blockIndex}: ContainerProps) => {
	const store = useStore()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const key = store.key

	const ContainerComponent = useMemo(() => resolveSlot<ElementType>('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])

	const token = tokens[0]
	const blockStore = store.blocks.get(token)
	const isDragging = blockStore.state.isDragging.use()

	return (
		<ContainerComponent
			ref={(el: HTMLElement | null) => blockStore.attachContainer(el, blockIndex, store.controllers.drag)}
			data-testid="block"
			{...containerProps}
			className={styles.Block}
			style={{opacity: isDragging ? 0.4 : 1}}
		>
			<DropIndicator token={token} position="before" />

			<DragHandle token={token} blockIndex={blockIndex} />

			{tokens.map(t => (
				<Token key={key.get(t)} mark={t} />
			))}

			<DropIndicator token={token} position="after" />

			<BlockMenu token={token} />
		</ContainerComponent>
	)
})

Container.displayName = 'Container'