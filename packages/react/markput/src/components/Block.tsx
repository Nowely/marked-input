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
}

export const Block = memo(({token}: BlockProps) => {
	const {blockStore, event, Component, slotProps, isDragging, tokens} = useMarkput(s => ({
		blockStore: s.blocks.get(token),
		event: s.event,
		Component: s.computed.blockComponent,
		slotProps: s.computed.blockProps,
		isDragging: s.blocks.get(token).state.isDragging,
		tokens: s.state.tokens,
	}))
	const blockIndex = tokens.indexOf(token)

	return (
		<Component
			ref={(el: HTMLElement | null) => blockStore.attachContainer(el, blockIndex, event)}
			data-testid="block"
			{...slotProps}
			// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.className is raw and needs casting to string
			className={cx(styles.Block, slotProps?.className as string | undefined)}
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