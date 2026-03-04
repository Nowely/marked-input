import {memo, useCallback, useMemo} from 'react'
import {splitTokensIntoBlocks, reorderBlocks, parseWithParser} from '@markput/core'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useStore} from '../lib/hooks/useStore'
import {Token} from './Token'
import {DraggableBlock} from './DraggableBlock'

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

	const ContainerComponent = useMemo(() => resolveSlot('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])

	const blocks = useMemo(() => splitTokensIntoBlocks(tokens), [tokens])

	const handleReorder = useCallback(
		(sourceIndex: number, targetIndex: number) => {
			if (!value || !onChange) return
			const newValue = reorderBlocks(value, blocks, sourceIndex, targetIndex)
			if (newValue !== value) {
				// Full re-parse: the incremental parser (getTokensByValue) cannot handle
				// global rearrangements. Set tokens + previousValue directly so that when
				// onChange triggers a re-render and syncParser fires, getTokensByValue
				// sees previousValue === value and returns the already-correct tokens.
				const newTokens = parseWithParser(store, newValue)
				store.state.tokens.set(newTokens)
				store.state.previousValue.set(newValue)
				onChange(newValue)
			}
		},
		[store, value, onChange, blocks]
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
