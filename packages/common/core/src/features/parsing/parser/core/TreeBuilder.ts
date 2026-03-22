import type {MarkToken, PositionRange, TextToken, Token} from '../types'
import {createTextToken} from '../utils/createTextToken'
import type {Match} from './Match'

/**
 * Parent context for tracking active nesting during tree building
 */
interface ParentContext {
	match: Match
	token: MarkToken
	textPos: number // Current position for adding text tokens
}

/**
 * TreeBuilder - Optimized single-pass tree building algorithm
 *
 * Algorithm: Single-pass approach with direct token creation
 * - Processes matches in order, maintaining a stack of active parents
 * - Creates tokens directly without intermediate data structures
 * - Handles text gaps and nesting in a single traversal
 *
 * Key optimizations:
 * - Single pass through matches (no separate relationship building phase)
 * - Direct token creation eliminates intermediate allocations
 * - Stack-based parent tracking with O(D) memory where D is nesting depth
 * - No need for parent indices array or children lists
 * - Simpler algorithm that's easier to understand and maintain
 *
 * Complexity: O(M) where M is number of matches
 * Memory: O(D) for active parents stack where D is nesting depth (typically 3-5)
 */
export class TreeBuilder {
	// Instance fields - only what's needed for single pass
	private input!: string

	// ===== PUBLIC API =====

	/**
	 * Builds nested token tree from pre-processed matches in a single pass
	 *
	 * Algorithm:
	 * 1. Iterate through matches in order
	 * 2. For each match:
	 *    - Close any parents whose content ends before this match
	 *    - Skip matches that conflict with the last accepted match
	 *    - Add text token before this match
	 *    - Create mark token and push to appropriate parent
	 *    - If match has nested content, push to active parents stack
	 * 3. After all matches, close remaining parents and add final text
	 *
	 * Complexity: O(M) where M is number of matches
	 * Memory: O(D) for active parents stack where D is nesting depth
	 */
	public build(matches: Match[], input: string): Token[] {
		this.input = input

		if (matches.length === 0) {
			return [this.createTextToken(0, input.length)]
		}

		return this.buildSinglePass(matches)
	}

	// ===== SINGLE-PASS ALGORITHM =====

	/**
	 * Builds token tree in a single pass through matches
	 *
	 * This is the core algorithm that processes matches sequentially,
	 * maintaining a stack of active parents and creating tokens directly.
	 */
	private buildSinglePass(matches: Match[]): Token[] {
		const roots: Token[] = []
		const parentStack: ParentContext[] = []
		let lastAcceptedMatch: Match | null = null
		let rootTextPos = 0

		for (const match of matches) {
			// Skip conflicting matches
			if (lastAcceptedMatch && match.conflictsWith(lastAcceptedMatch)) {
				continue
			}

			lastAcceptedMatch = match

			// Close parents whose content ends before this match
			while (parentStack.length > 0) {
				const parent = parentStack[parentStack.length - 1]
				const parentBounds = this.getContentBounds(parent.match)

				if (parentBounds.end <= match.start) {
					// Parent is complete - finalize it
					this.finalizeParent(parent, parentBounds.end)
					parentStack.pop()

					// Add to appropriate container
					if (parentStack.length > 0) {
						parentStack[parentStack.length - 1].token.children.push(parent.token)
					} else {
						roots.push(parent.token)
					}
				} else {
					break
				}
			}

			// Determine where to add this match
			const container = parentStack.length > 0 ? parentStack[parentStack.length - 1] : null

			if (container) {
				// Add text before this match within parent
				const textToken = this.createTextToken(container.textPos, match.start)
				container.token.children.push(textToken)
				container.textPos = match.end
			} else {
				// Add text before this match at root level
				const textToken = this.createTextToken(rootTextPos, match.start)
				roots.push(textToken)
				rootTextPos = match.end
			}

			// Create mark token for this match
			const markToken = this.createMarkToken(match)

			// If match has children content, push to stack for processing children
			if (this.hasChildrenContent(match)) {
				const bounds = this.getContentBounds(match)
				parentStack.push({
					match,
					token: markToken,
					textPos: bounds.start,
				})
			} else {
				// No nested content - add directly to container
				if (container) {
					container.token.children.push(markToken)
				} else {
					roots.push(markToken)
				}
			}
		}

		// Close remaining parents
		while (parentStack.length > 0) {
			const parent = parentStack.pop()!
			const parentBounds = this.getContentBounds(parent.match)
			this.finalizeParent(parent, parentBounds.end)

			if (parentStack.length > 0) {
				parentStack[parentStack.length - 1].token.children.push(parent.token)
			} else {
				roots.push(parent.token)
			}
		}

		// Add final text token at root level
		roots.push(this.createTextToken(rootTextPos, this.input.length))

		return roots
	}

	/**
	 * Finalizes a parent token by adding final text token if needed
	 */
	private finalizeParent(parent: ParentContext, endPos: number): void {
		const hasNestedMarks = parent.token.children.some(child => child.type === 'mark')
		if (hasNestedMarks) {
			// Add final text token within parent's content
			parent.token.children.push(this.createTextToken(parent.textPos, endPos))
		} else {
			// No nested marks — clear children (no text-only children in output)
			parent.token.children = []
		}
	}

	/**
	 * Creates a mark token from a match (without children - those are added later)
	 */
	private createMarkToken(match: Match): MarkToken {
		// Extract content using helper functions
		const value = this.extractSubstring(match.gaps.value?.start, match.gaps.value?.end)
		const childrenStr = this.extractSubstring(match.gaps.children?.start, match.gaps.children?.end)
		const metaStr = this.extractSubstring(match.gaps.meta?.start, match.gaps.meta?.end)

		// Convert empty strings to undefined for children, but meta can be empty string
		const childrenContent = childrenStr || undefined
		const meta = match.gaps.meta !== undefined ? metaStr : undefined

		// Use value if present, otherwise use children content
		const valueContent = value || childrenContent || ''

		return {
			type: 'mark',
			content: this.input.substring(match.start, match.end),
			children: [], // Will be populated if match has children content
			descriptor: match.descriptor,
			value: valueContent,
			meta,
			position: {start: match.start, end: match.end},
			childrenSource: this.createChildrenSourceInfo(match, childrenContent),
		}
	}

	// ===== UTILITY METHODS =====

	/**
	 * Gets the content boundaries for a match
	 * Priority: nested content if present, otherwise value content
	 */
	private getContentBounds(match: Match): PositionRange {
		if (match.gaps.children) {
			return match.gaps.children
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
	 * Checks if a match has children content capability
	 */
	private hasChildrenContent(match: Match): boolean {
		return match.gaps.children !== undefined
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
		return createTextToken(this.input, start, end)
	}

	/**
	 * Creates children source info object if children content exists
	 */
	private createChildrenSourceInfo(match: Match, childrenContent: string | undefined): MarkToken['childrenSource'] {
		if (!childrenContent || match.gaps.children === undefined) {
			return undefined
		}
		return {
			content: childrenContent,
			start: match.gaps.children.start,
			end: match.gaps.children.end,
		}
	}
}