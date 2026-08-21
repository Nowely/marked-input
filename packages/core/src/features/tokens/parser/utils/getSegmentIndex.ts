/**
 * Creates a value-specific index for a dynamic segment by hashing its matched text (djb2),
 * so a closing tag only dequeues the match that opened with the same value.
 *
 * Callers pass only dynamic segments; static segments keep their raw registry index.
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

	return baseIndex * 1000000 + (hash & 0xfffff)
}