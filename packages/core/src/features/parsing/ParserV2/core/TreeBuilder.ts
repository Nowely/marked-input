import {TextToken, MarkToken, Token, PositionRange} from '../types'
import {Match} from './Match'

/**
 * TreeBuilder - Optimized tree building with deferred token creation
 *
 * Algorithm: Two-phase approach for better performance
 * Phase 1: Build parent-child relationships efficiently (O(M·D) where D is nesting depth)
 * Phase 2: Create tokens recursively from relationships (O(M))
 *
 * Key optimizations:
 * - Deferred token creation eliminates intermediate object churn
 * - Lightweight parent tracking (Int32Array) vs heavy StackNode objects
 * - Batch token creation instead of incremental finalization
 * - Better cache locality with array-based parent indices
 * - Pre-computed children lists for O(1) lookup instead of O(M) scans
 */
export class TreeBuilder {
	// Instance fields
	private input!: string
	private matches!: Match[]
	private parents!: Int32Array // Parent index for each match (-1 = root, -2 = skipped)
	private childrenLists!: Map<number, number[]> // Map of parent index to list of child indices

	// ===== PUBLIC API =====

	/**
	 * Builds nested token tree from pre-processed matches
	 *
	 * Algorithm:
	 * 1. Build parent-child relationships using active parents stack: O(M·D)
	 *    - Track currently open parents (matches with nested content)
	 *    - Close parents when current match is beyond their bounds
	 *    - Link each match to its immediate parent
	 * 2. Build tokens recursively from root matches: O(M)
	 *    - Process only root-level matches
	 *    - Recursively build children tokens
	 *    - Fill gaps with text tokens
	 *
	 * Complexity: O(M·D) where D is typical nesting depth (3-5)
	 * Memory: O(M) for parent indices + O(D) for active parents stack
	 */
	public build(matches: Match[], input: string): Token[] {
		this.input = input
		this.matches = matches
		this.parents = new Int32Array(matches.length).fill(-1)
		this.childrenLists = new Map()

		if (matches.length === 0) {
			return [this.createTextToken(0, input.length)]
		}

		// Phase 1: Build parent-child relationships
		this.buildParentChildRelationships(matches)

		// Phase 1.5: Pre-compute children lists for O(1) lookup
		this.buildChildrenLists()

		// Phase 2: Build tokens from root matches
		return this.buildTokensFromRoots()
	}

	// ===== PHASE 1: PARENT-CHILD RELATIONSHIP BUILDING =====

	/**
	 * Builds parent-child relationships efficiently using active parents tracking
	 * Uses conflict detection to filter out overlapping matches
	 */
	private buildParentChildRelationships(matches: Match[]): void {
		const activeParents: number[] = [] // Stack of match indices
		let lastAcceptedMatchIdx = -1

		for (let i = 0; i < matches.length; i++) {
			const match = matches[i]

			// Skip matches that conflict with the last accepted match
			if (lastAcceptedMatchIdx >= 0 && match.conflictsWith(matches[lastAcceptedMatchIdx])) {
				this.parents[i] = -2 // Mark as skipped (-2 distinguishes from root -1)
				continue
			}

			lastAcceptedMatchIdx = i

			// Close completed parents (those whose nested content ends before this match)
			while (activeParents.length > 0) {
				const parentIdx = activeParents[activeParents.length - 1]
				const parentMatch = matches[parentIdx]
				const parentBounds = this.getContentBounds(parentMatch)

				// If this match starts at or after parent's content end, parent is complete
				if (parentBounds.end <= match.start) {
					activeParents.pop()
				} else {
					break
				}
			}

			// Link to immediate parent if one exists
			if (activeParents.length > 0) {
				this.parents[i] = activeParents[activeParents.length - 1]
			}

			// Add this match to active parents if it has nested content
			if (this.hasNestedContent(match)) {
				activeParents.push(i)
			}
		}
	}

	/**
	 * Pre-computes children lists for each parent for O(1) lookup
	 * This avoids O(M) scans in buildChildrenTokens
	 */
	private buildChildrenLists(): void {
		for (let i = 0; i < this.matches.length; i++) {
			const parentIdx = this.parents[i]
			// Skip skipped matches (-2) and root matches (-1)
			if (parentIdx < 0) continue

			// Get or create children list for this parent
			let children = this.childrenLists.get(parentIdx)
			if (!children) {
				children = []
				this.childrenLists.set(parentIdx, children)
			}
			children.push(i)
		}
	}

	// ===== PHASE 2: TOKEN BUILDING =====

	/**
	 * Builds tokens from root matches (those with parent = -1)
	 */
	private buildTokensFromRoots(): Token[] {
		const result: Token[] = []
		let textPos = 0

		for (let i = 0; i < this.matches.length; i++) {
			// Skip non-root matches and skipped matches
			if (this.parents[i] !== -1) continue

			const match = this.matches[i]

			// Add text before this match (even if empty)
			result.push(this.createTextToken(textPos, match.start))

			// Build mark token with children
			result.push(this.buildMarkToken(i))

			textPos = match.end
		}

		// Add remaining text (even if empty)
		result.push(this.createTextToken(textPos, this.input.length))

		return result
	}

	/**
	 * Builds a mark token for the given match index, including its children
	 */
	private buildMarkToken(matchIdx: number): MarkToken {
		const match = this.matches[matchIdx]
		const children = this.buildChildrenTokens(matchIdx)

		// Extract content using helper functions
		const value = this.extractSubstring(match.gaps.value?.start, match.gaps.value?.end)
		const nestedStr = this.extractSubstring(match.gaps.nested?.start, match.gaps.nested?.end)
		const metaStr = this.extractSubstring(match.gaps.meta?.start, match.gaps.meta?.end)

		// Convert empty strings to undefined for nested, but meta can be empty string
		const nested = nestedStr || undefined
		const meta = match.gaps.meta !== undefined ? metaStr : undefined

		// Use value if present, otherwise use nested content
		const valueContent = value || nested || ''

		// Only include children if there are nested marks (not just text tokens)
		const hasNestedMarks = children.some(child => child.type === 'mark')

		return {
			type: 'mark',
			content: this.input.substring(match.start, match.end),
			children: hasNestedMarks ? children : [],
			descriptor: match.descriptor,
			value: valueContent,
			meta,
			position: {start: match.start, end: match.end},
			nested: this.createNestedInfo(match, nested),
		}
	}

	/**
	 * Builds children tokens for a given parent match
	 * Uses pre-computed children list for O(1) lookup
	 */
	private buildChildrenTokens(parentIdx: number): Token[] {
		const children: Token[] = []
		const parentMatch = this.matches[parentIdx]
		const bounds = this.getContentBounds(parentMatch)
		let textPos = bounds.start

		// Get pre-computed children list (O(1) lookup)
		const childIndices = this.childrenLists.get(parentIdx)
		if (!childIndices) {
			// No children, just return text token for entire content
			children.push(this.createTextToken(bounds.start, bounds.end))
			return children
		}

		// Process each child in order
		for (const i of childIndices) {
			const childMatch = this.matches[i]

			// Add text before this child (even if empty)
			children.push(this.createTextToken(textPos, childMatch.start))

			// Add child mark token (recursively builds its children)
			children.push(this.buildMarkToken(i))

			textPos = childMatch.end
		}

		// Add remaining text within parent's content (even if empty)
		children.push(this.createTextToken(textPos, bounds.end))

		return children
	}

	// ===== UTILITY METHODS =====

	/**
	 * Gets the content boundaries for a match
	 * Priority: nested content if present, otherwise value content
	 */
	private getContentBounds(match: Match): PositionRange {
		if (match.gaps.nested) {
			return match.gaps.nested
		}
		if (match.gaps.value) {
			return match.gaps.value
		}
		return {
			start: match.start,
			end: match.start,
		}
	}

	/**
	 * Checks if a match has nested content capability
	 */
	private hasNestedContent(match: Match): boolean {
		return match.gaps.nested !== undefined
	}

	/**
	 * Extracts substring safely, returns empty string if positions are undefined
	 */
	private extractSubstring(start: number | undefined, end: number | undefined): string {
		return start !== undefined && end !== undefined ? this.input.substring(start, end) : ''
	}

	/**
	 * Creates a text token for a range in the input
	 */
	private createTextToken(start: number, end: number): TextToken {
		// Validate positions
		if (start > end) {
			throw new Error(
				`Invalid text token positions: start (${start}) > end (${end}). ` +
					`This indicates a bug in the tree building logic.`
			)
		}

		return {
			type: 'text',
			content: this.input.substring(start, end),
			position: {start, end},
		}
	}

	/**
	 * Creates nested info object if nested content exists
	 */
	private createNestedInfo(match: Match, nested: string | undefined): MarkToken['nested'] {
		if (!nested || match.gaps.nested === undefined) {
			return undefined
		}
		return {
			content: nested,
			start: match.gaps.nested.start,
			end: match.gaps.nested.end,
		}
	}
}

