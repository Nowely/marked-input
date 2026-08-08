import {describe, expectTypeOf, it} from 'vitest'

import type {Token} from '../parser/types'
import type {CommitSink, Id, NodeAnchor, TransactionResult, TreeNode, Window} from './types'

describe('tree contract types', () => {
	it('models the spec §2.3/§4.1 shapes', () => {
		expectTypeOf<Id>().toEqualTypeOf<number>()
		expectTypeOf<Window>().toEqualTypeOf<{start: number; end: number; insertedLength: number}>()
		// NodeAnchor: text offsets, boundary forms, document edges
		const start: NodeAnchor = 'start'
		const end: NodeAnchor = 'end'
		expectTypeOf(start).toMatchTypeOf<NodeAnchor>()
		expectTypeOf(end).toMatchTypeOf<NodeAnchor>()
		// TransactionResult is the single change feed
		expectTypeOf<TransactionResult['removed']>().toEqualTypeOf<Id[]>()
		expectTypeOf<TransactionResult['map']>().toMatchTypeOf<(offset: number) => NodeAnchor>()
		expectTypeOf<CommitSink['commit']>().toMatchTypeOf<(next: string, window: Window) => boolean>()
		// A TreeNode is a TextNode or MarkNode discriminated by `kind`
		expectTypeOf<TreeNode['kind']>().toEqualTypeOf<'text' | 'mark'>()
		// Snapshot mapping speaks parser Token
		expectTypeOf<Token['type']>().toEqualTypeOf<'text' | 'mark'>()
	})
})