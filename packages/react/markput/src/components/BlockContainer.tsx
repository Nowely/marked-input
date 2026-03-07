import {
	resolveSlot,
	resolveSlotProps,
	splitTokensIntoBlocks,
	reorderBlocks,
	parseWithParser,
	type Block,
} from '@markput/core'
import type {ElementType} from 'react'
import {memo, useCallback, useMemo, useRef} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {DraggableBlock} from './DraggableBlock'
import {Token} from './Token'

export const BlockContainer = memo(() => {
	const store = useStore()
	const tokens = store.state.tokens.use()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const className = store.state.className.use()
	const style = store.state.style.use()
	const readOnly = store.state.readOnly.use()
	const value = store.state.value.use()
	const onChange = store.state.onChange.use()
	const key = store.key
	const refs = store.refs

	const ContainerComponent = useMemo(() => resolveSlot<ElementType>('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])

	const blocks = useMemo(() => splitTokensIntoBlocks(tokens), [tokens])
	const blocksRef = useRef<Block[]>(blocks)
	blocksRef.current = blocks

	const handleReorder = useCallback(
		(sourceIndex: number, targetIndex: number) => {
			if (!value || !onChange) return
			const currentBlocks = blocksRef.current
			const newValue = reorderBlocks(value, currentBlocks, sourceIndex, targetIndex)
			if (newValue !== value) {
				const newTokens = parseWithParser(store, newValue)
				store.state.tokens.set(newTokens)
				store.state.previousValue.set(newValue)
				onChange(newValue)
			}
		},
		[store, value, onChange]
	)

	return (
		<ContainerComponent
			ref={(el: HTMLDivElement | null) => (refs.container = el)}
			{...containerProps}
			className={className}
			style={style}
		>
			{blocks.map((block, index) => (
				<DraggableBlock key={block.id} blockIndex={index} readOnly={readOnly} onReorder={handleReorder}>
					{block.tokens.map(token => (
						<Token key={key.get(token)} mark={token} />
					))}
				</DraggableBlock>
			))}
		</ContainerComponent>
	)
})

BlockContainer.displayName = 'BlockContainer'