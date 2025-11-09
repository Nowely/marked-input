/**
 * Creates a value-specific index using djb2 hash algorithm for dynamic segments
 * For static segments, returns the base index directly to avoid unnecessary hashing
 *
 * @param baseIndex - The base index of the segment type
 * @param value - The actual value of the segment (optional, for dynamic segments only)
 * @returns Value-specific index for dynamic segments, or base index for static segments
 */
export function getSegmentIndex(baseIndex: number, value?: string): number {
	if (!value) {
		return baseIndex
	}

	let hash = 5381
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 33) ^ value.charCodeAt(i)
	}
	hash = hash >>> 0 // Unsigned 32-bit integer

	return baseIndex * 1000000 + (hash & 0xFFFFF)
}
