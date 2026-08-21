/** Width of the hash field, and therefore of one segment's key block. */
const HASH_BITS = 20
const HASH_MASK = (1 << HASH_BITS) - 1

/**
 * Creates a value-specific index for a dynamic segment by hashing its matched text (djb2),
 * so a closing tag only dequeues the match that opened with the same value.
 *
 * Callers pass only dynamic segments; static segments keep their raw registry index.
 *
 * KEYS ARE BLOCKED, and that is what keeps them apart from the raw indices they share a map
 * with (`PatternMatcher.pendingStates` / `completingStates`). Each base index owns the block
 * `[(base+1) << 20, (base+2) << 20)`, so no hash can reach another base's block, and block 0 is
 * left to the static segments, whose key IS their raw registry index.
 *
 * The multiplier used to be 1e6 while the mask stayed 0xfffff = 1048575 — wider than the
 * stride. Two consequences, both reachable: a base-0 key could land in `[0, 1048575]` and
 * collide with a real static index, and adjacent bases overlapped by 48575. The first one
 * misparsed: with `['<__value__>__slot__</__value__>', '**__slot__**', ...]`, `'<i:nx>'` hashed
 * onto `'**'`'s raw index, so the closing `**` dequeued the waiting HTML match instead of its
 * own and the bold mark ended at the `>`. Gated by `Parser.spec`'s "a dynamic value cannot
 * hash onto a static segment's key".
 *
 * @param baseIndex - The base index of the segment type
 * @param value - The matched text of the dynamic segment (never empty: the pattern captures 1+ chars)
 * @returns Value-specific index for the dynamic segment
 */
export function getSegmentIndex(baseIndex: number, value: string): number {
	let hash = 5381
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 33) ^ value.charCodeAt(i)
	}
	hash = hash >>> 0 // Unsigned 32-bit integer

	return (baseIndex + 1) * (1 << HASH_BITS) + (hash & HASH_MASK)
}