import {annotate} from '../parser/utils/annotate'
import type {MarkNode, MarkPatch} from './types'

/**
 * A patch becomes markup. Moved out of the deleted `MarkController` (`#serialize` plus its
 * three field defaults) so the node can serialize without reaching into the store; the only
 * semantic change is `null` instead of `{kind: 'clear'}` (plan decision D-b).
 *
 * The defaults come off the NODE: an omitted key must round-trip the current field, and the
 * slot's current value is the joined children, because the node stores no slot text
 * (`MarkNode.slotRange` is positions only).
 */
export function serializeMark(node: MarkNode, patch: MarkPatch): string {
	const value = patch.value ?? node.value()
	const meta = patch.meta === null ? undefined : (patch.meta ?? node.meta())
	const slot = patch.slot === null ? undefined : (patch.slot ?? node.slot())
	return annotate(node.markup, {
		value,
		meta: node.descriptor.gapTypes.includes('meta') ? (meta ?? '') : undefined,
		slot: node.descriptor.hasSlot ? (slot ?? '') : undefined,
	})
}