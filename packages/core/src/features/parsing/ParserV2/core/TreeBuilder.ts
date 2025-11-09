import {TextToken, MarkToken, Token, PositionRange} from '../types'
import {Match} from './Match'

/**
 * Stack node structure for tree building
 */
interface StackNode {
	match: Match
	children: Token[]
	textPos: number
}

/**
 * TreeBuilder class - builds nested token tree from matches
 *
 * Algorithm: O(N) stack-based tree building with inline filtering
 */
export class TreeBuilder {
	// Instance fields - lazy initialized for each buildTree call
	private input!: string
	private result: Token[] = []
	private stack: StackNode[] = []
	private currentTextPosition!: number

	// ===== PUBLIC API =====

	/**
	 * Builds nested token tree from pre-processed matches
	 *
	 * Algorithm:
	 * 1. Process pre-sorted, deduplicated matches from PatternMatcher
	 * 2. Apply inline overlap filtering to prevent invalid nesting
	 * 3. Use stack-based tree building to construct nested structure
	 * 4. Close completed parents when current match is not inside their nested content
	 * 5. Skip invalid matches with corrupted nested content
	 * 6. Finalize remaining stack at the end
	 *
	 * Complexity: O(N) where N is number of matches
	 */
	public build(matches: Match[], input: string): Token[] {
		this.input = input
		this.result.length = 0
		this.stack.length = 0
		this.currentTextPosition = 0

		if (matches.length === 0) return [this.createTextToken(0, input.length)]

		let lastAcceptedMatch: Match | null = null
		for (const match of matches) {
			if (match.conflictsWith(lastAcceptedMatch)) continue

			lastAcceptedMatch = match

			// Close completed parents that don't contain this match
			this.closeCompletedParents(match)

			// Add this match to the stack for potential children
			this.addMatchToStack(match)
		}

		this.finalizeRemainingStack()

		this.result.push(this.createTextToken(this.currentTextPosition, input.length))

		return [...this.result]
	}

	/**
	 * Closes completed parents that don't contain the current match
	 */
	private closeCompletedParents(match: Match): void {
		while (this.stack.length > 0) {
			const topNode = this.stack[this.stack.length - 1]
			const bounds = this.getContentBounds(topNode.match)

			if (bounds.end <= match.start) {
				// Pop before finalizing (so stack.length reflects parent context)
				const node = this.stack.pop()!
				this.finalizeStackNode(node)
			} else {
				break
			}
		}
	}

	// ===== CORE TREE BUILDING METHODS =====

	/**
	 * Finalizes a stack node by creating a mark token and adding it to the target
	 * Handles both parent and root-level token placement
	 */
	private finalizeStackNode(node: StackNode): void {
		this.addRemainingTextToNode(node)

		const token = this.createMarkToken(node.match, node.children)
		const isNested = this.stack.length > 0

		if (isNested) {
			this.addTokenToParent(token, node)
		} else {
			this.addTokenToRoot(token)
		}
	}

	

	/**
	 * Adds a match to the stack for potential children processing
	 */
	private addMatchToStack(match: Match): void {
		const bounds = this.getContentBounds(match)
		this.stack.push({
			match,
			children: [],
			textPos: bounds.start,
		})
	}

	/**
	 * Finalizes all remaining marks in the stack
	 */
	private finalizeRemainingStack(): void {
		while (this.stack.length > 0) {
			const node = this.stack.pop()!
			this.finalizeStackNode(node)
		}
	}

	// ===== TOKEN CREATION METHODS =====

	/**
	 * Creates a mark token from match and collected children
	 * Extracts substrings from input on demand
	 */
	private createMarkToken(match: Match, children: Token[]): MarkToken {
		// Extract content using helper functions - extractSubstring handles undefined positions
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
	 * Creates a text token for a range in the input
	 * Validates that start <= end to prevent invalid tokens
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
	 * Extracts substring safely, returns empty string if positions are undefined
	 */
	private extractSubstring(start: number | undefined, end: number | undefined): string {
		return start !== undefined && end !== undefined ? this.input.substring(start, end) : ''
	}

	/**
	 * Adds remaining text to a stack node before finalization
	 */
	private addRemainingTextToNode(node: StackNode): void {
		const bounds = this.getContentBounds(node.match)
		node.children.push(this.createTextToken(node.textPos, bounds.end))
	}

	/**
	 * Adds a token to its parent in the stack
	 */
	private addTokenToParent(token: MarkToken, node: StackNode): void {
		const parent = this.stack[this.stack.length - 1]
		parent.children.push(this.createTextToken(parent.textPos, token.position.start))
		parent.children.push(token)
		parent.textPos = token.position.end
	}

	/**
	 * Adds a token to the root result array
	 */
	private addTokenToRoot(token: MarkToken): void {
		this.result.push(this.createTextToken(this.currentTextPosition, token.position.start))
		this.result.push(token)
		this.currentTextPosition = token.position.end
	}
}
