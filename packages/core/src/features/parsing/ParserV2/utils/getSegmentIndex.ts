/**
 * Creates a value-specific index using djb2 hash algorithm
 * This ensures that segments with different values get unique indices,
 * preventing incorrect matches in hasTwoValues patterns
 *
 * @param baseIndex - The base index of the segment type
 * @param value - The actual value of the segment
 * @returns Value-specific index for the segment
 */
export function getSegmentIndex(baseIndex: number, value: string): number {
	let hash = 5381
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 33) ^ value.charCodeAt(i)
	}
	hash = hash >>> 0 // Unsigned 32-bit integer

	return baseIndex * 1000000 + (hash & 0xFFFFF)
}
