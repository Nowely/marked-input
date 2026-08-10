// `expectTypeOf` erases at runtime: this file is enforced by `pnpm run typecheck`, not by the vitest run.
import {describe, expectTypeOf, it} from 'vitest'

import type {Signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {Markup} from '../parser/types'
import type {
	CommitSink,
	Id,
	MarkNode,
	MarkPatch,
	NodeAnchor,
	TextNode,
	TransactionResult,
	TreeChange,
	TreeNode,
	Window,
} from './types'

describe('tree contract types', () => {
	it('models the spec §2.3/D9/D5 shapes', () => {
		expectTypeOf<Id>().toEqualTypeOf<number>()
		expectTypeOf<Window>().toEqualTypeOf<{
			readonly start: number
			readonly end: number
			readonly insertedLength: number
		}>()
		// Every field is pinned: dropping one from types.ts must fail the typecheck
		expectTypeOf<TextNode>().toMatchObjectType<{
			readonly kind: 'text'
			readonly id: Id
			readonly text: Signal<string>
			position: {start: number; end: number}
			range: () => {start: number; end: number}
		}>()
		expectTypeOf<MarkNode>().toMatchObjectType<{
			readonly kind: 'mark'
			readonly id: Id
			readonly descriptor: MarkupDescriptor
			readonly markup: Markup
			readonly value: Signal<string>
			readonly meta: Signal<string | undefined>
			readonly children: Signal<readonly TreeNode[]>
			slotRange: {start: number; end: number} | undefined
			position: {start: number; end: number}
			slot: () => string | undefined
			range: () => {start: number; end: number}
			update: (patch: MarkPatch) => boolean
			remove: () => boolean
		}>()
		// NodeAnchor: text offsets, boundary forms, document edges — the annotation is the check
		const start: NodeAnchor = 'start'
		const end: NodeAnchor = 'end'
		void start
		void end
		// Mark interiors are NOT anchorable (spec §2.3): they are reached through slot text nodes
		expectTypeOf<{node: MarkNode; offset: number}>().not.toExtend<NodeAnchor>()
		// TransactionResult is the single change feed
		expectTypeOf<TransactionResult['added']>().toEqualTypeOf<readonly TreeChange[]>()
		expectTypeOf<TransactionResult['removed']>().toEqualTypeOf<readonly Id[]>()
		expectTypeOf<TransactionResult['map']>().toExtend<(offset: number) => NodeAnchor>()
		expectTypeOf<CommitSink['commit']>().toExtend<(next: string, window: Window) => boolean>()
		// A TreeNode is a TextNode or MarkNode discriminated by `kind`
		expectTypeOf<TreeNode['kind']>().toEqualTypeOf<'text' | 'mark'>()
	})
})