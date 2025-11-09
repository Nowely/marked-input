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
	private extractSubstring(input: string, start: number | undefined, end: number | undefined): string {
		return start !== undefined && end !== undefined ? input.substring(start, end) : ''
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

	/**
	 * Creates a text token for a range in the input
	 * Validates that start <= end to prevent invalid tokens
	 */
	private createTextToken(input: string, start: number, end: number): TextToken {
		// Validate positions
		if (start > end) {
			throw new Error(
				`Invalid text token positions: start (${start}) > end (${end}). ` +
					`This indicates a bug in the tree building logic.`
			)
		}

		return {
			type: 'text',
			content: input.substring(start, end),
			position: {start, end},
		}
	}

	/**
	 * Creates a mark token from match and collected children
	 * Extracts substrings from input on demand
	 */
	private createMarkToken(input: string, match: Match, children: Token[]): MarkToken {
		// Extract content using helper functions - extractSubstring handles undefined positions
		const value = this.extractSubstring(input, match.gaps.value?.start, match.gaps.value?.end)
		const nestedStr = this.extractSubstring(input, match.gaps.nested?.start, match.gaps.nested?.end)
		const metaStr = this.extractSubstring(input, match.gaps.meta?.start, match.gaps.meta?.end)

		// Convert empty strings to undefined for nested, but meta can be empty string
		const nested = nestedStr || undefined
		const meta = match.gaps.meta !== undefined ? metaStr : undefined

		// Use value if present, otherwise use nested content
		const valueContent = value || nested || ''

		// Only include children if there are nested marks (not just text tokens)
		const hasNestedMarks = children.some(child => child.type === 'mark')

		return {
			type: 'mark',
			content: input.substring(match.start, match.end),
			children: hasNestedMarks ? children : [],
			descriptor: match.descriptor,
			value: valueContent,
			meta,
			position: {start: match.start, end: match.end},
			nested: this.createNestedInfo(match, nested),
		}
	}


	/**
	 * Checks if match is valid nesting inside existing match's nested section
	 */
	private isValidNesting(match: Match, existing: Match): boolean {
		if (!existing.descriptor.hasNested) return false
		if (existing.gaps.nested === undefined) return false
		return match.start >= existing.gaps.nested.start && match.end <= existing.gaps.nested.end
	}

	/**
	 * Finalizes a stack node by creating a mark token and adding it to the target
	 * Handles both parent and root-level token placement
	 */
	private finalizeStackNode(
		node: StackNode,
		input: string,
		stack: StackNode[],
		result: Token[],
		currentTextPosition: number
	): number {
		const bounds = this.getContentBounds(node.match)

		// Add remaining text in mark (always, even if empty)
		node.children.push(this.createTextToken(input, node.textPos, bounds.end))

		// Create token
		const token = this.createMarkToken(input, node.match, node.children)

		// Determine target: parent's children or root tokens
		const hasParent = stack.length > 0
		const targetTokens = hasParent ? stack[stack.length - 1].children : result
		const targetPos = hasParent ? stack[stack.length - 1].textPos : currentTextPosition

		// Add text before token (always, even if empty)
		targetTokens.push(this.createTextToken(input, targetPos, token.position.start))
		targetTokens.push(token)

		// Update position
		if (hasParent) {
			stack[stack.length - 1].textPos = token.position.end
			return currentTextPosition // No change to root position
		} else {
			return token.position.end // Update root position
		}
	}


	/**
	 * Closes completed parents that don't contain the current match
	 */
	private closeCompletedParents(
		stack: StackNode[],
		match: Match,
		input: string,
		result: Token[],
		currentTextPosition: number
	): number {
		let position = currentTextPosition

		while (stack.length > 0) {
			const top = stack[stack.length - 1]
			const bounds = this.getContentBounds(top.match)

			if (bounds.end <= match.start) {
				// Pop before finalizing (so stack.length reflects parent context)
				const node = stack.pop()!
				position = this.finalizeStackNode(node, input, stack, result, position)
			} else {
				break
			}
		}

		return position
	}

	/**
	 * Adds a match to the stack for potential children processing
	 */
	private addMatchToStack(stack: StackNode[], match: Match): void {
		const bounds = this.getContentBounds(match)
		stack.push({
			match,
			children: [],
			textPos: bounds.start,
		})
	}

	/**
	 * Finalizes all remaining marks in the stack
	 */
	private finalizeRemainingStack(
		stack: StackNode[],
		input: string,
		result: Token[],
		currentTextPosition: number
	): number {
		let position = currentTextPosition

		while (stack.length > 0) {
			const node = stack.pop()!
			position = this.finalizeStackNode(node, input, stack, result, position)
		}

		return position
	}

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
	public buildTree(matches: Match[], input: string): Token[] {
		if (matches.length === 0) {
			return [this.createTextToken(input, 0, input.length)]
		}

		const result: Token[] = []
		const stack: StackNode[] = []
		let currentTextPosition = 0
		let lastAcceptedMatch: Match | null = null

		// PatternMatcher now guarantees: sorted order, no duplicates, only completed matches with valid gaps
		for (const match of matches) {

			// Check for overlaps with last accepted match (filtering logic from filterMatches)
			if (lastAcceptedMatch && match.start < lastAcceptedMatch.end) {
				// Check if this is valid nesting inside lastAcceptedMatch
				if (this.isValidNesting(match, lastAcceptedMatch)) {
					// Valid nesting - accept this match and update tracking
					lastAcceptedMatch = match
				} else {
					// Invalid overlap - skip this match
					continue
				}
			} else {
				// No overlap - accept this match
				lastAcceptedMatch = match
			}

			// Close completed parents that don't contain this match
			currentTextPosition = this.closeCompletedParents(stack, match, input, result, currentTextPosition)

			// Add this match to the stack for potential children
			this.addMatchToStack(stack, match)
		}

		// Finalize all remaining marks in stack
		currentTextPosition = this.finalizeRemainingStack(stack, input, result, currentTextPosition)

		// Add final text after all marks (always, even if empty)
		result.push(this.createTextToken(input, currentTextPosition, input.length))

		return result
	}
}
