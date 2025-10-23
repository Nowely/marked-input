/**
 * Interval for tracking consumed ranges
 */
interface Interval {
	start: number
	end: number // inclusive
	length?: number // Optional: for tracking segment length in prefix conflicts
}

/**
 * Efficient interval-based set for tracking consumed positions
 * Replaces Set<number> with O(log N) overlap checks instead of O(M) position loops
 * 
 * Maintains sorted, non-overlapping intervals for optimal performance
 */
export class IntervalSet {
	private intervals: Interval[] = []

	/**
	 * Adds a range of positions to the set
	 * Merges with existing intervals if they overlap
	 * Complexity: O(N) worst case, O(log N) average case
	 */
	addRange(start: number, end: number): void {
		if (start > end) return // Invalid range

		// Find insertion point with binary search
		let left = 0
		let right = this.intervals.length

		while (left < right) {
			const mid = Math.floor((left + right) / 2)
			if (this.intervals[mid].end < start - 1) {
				left = mid + 1
			} else {
				right = mid
			}
		}

		// Merge overlapping intervals
		const newInterval: Interval = { start, end }
		let mergeStart = left

		// Find all intervals that overlap with the new one
		while (mergeStart < this.intervals.length && this.intervals[mergeStart].start <= end + 1) {
			newInterval.start = Math.min(newInterval.start, this.intervals[mergeStart].start)
			newInterval.end = Math.max(newInterval.end, this.intervals[mergeStart].end)
			mergeStart++
		}

		// Replace overlapping intervals with merged one
		this.intervals.splice(left, mergeStart - left, newInterval)
	}

	/**
	 * Checks if a range overlaps with any consumed interval
	 * Complexity: O(log N) with binary search
	 */
	overlaps(start: number, end: number): boolean {
		if (start > end) return false

		// Binary search for potential overlapping interval
		let left = 0
		let right = this.intervals.length

		while (left < right) {
			const mid = Math.floor((left + right) / 2)
			const interval = this.intervals[mid]

			// Check if current interval overlaps with [start, end]
			if (interval.start <= end && interval.end >= start) {
				return true // Found overlap
			}

			if (interval.end < start) {
				left = mid + 1
			} else {
				right = mid
			}
		}

		return false
	}

	/**
	 * Checks if any position in the range is consumed
	 * Alias for overlaps() for backwards compatibility
	 */
	hasAnyPosition(start: number, end: number): boolean {
		return this.overlaps(start, end)
	}

	/**
	 * Gets the number of intervals (for debugging)
	 */
	size(): number {
		return this.intervals.length
	}

	/**
	 * Clears all intervals
	 */
	clear(): void {
		this.intervals = []
	}
}

