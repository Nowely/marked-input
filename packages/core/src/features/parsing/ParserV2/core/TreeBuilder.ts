import {TextToken, MarkToken, Token, PositionRange} from '../types'
import {Match} from './PatternMatcher'

/**
 * Gets the content boundaries for a match
 * Priority: nested content if present, otherwise value content
 */
function getContentBounds(match: Match): PositionRange {
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
function extractSubstring(input: string, start: number | undefined, end: number | undefined): string {
	return start !== undefined && end !== undefined ? input.substring(start, end) : ''
}

/**
 * Creates nested info object if nested content exists
 */
function createNestedInfo(match: Match, nested: string | undefined): MarkToken['nested'] {
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
function createTextToken(input: string, start: number, end: number): TextToken {
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
function createMarkToken(input: string, match: Match, children: Token[]): MarkToken {
	// Extract content using helper functions - extractSubstring handles undefined positions
	const value = extractSubstring(input, match.gaps.value?.start, match.gaps.value?.end)
	const nestedStr = extractSubstring(input, match.gaps.nested?.start, match.gaps.nested?.end)
	const metaStr = extractSubstring(input, match.gaps.meta?.start, match.gaps.meta?.end)

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
		nested: createNestedInfo(match, nested),
	}
}

/**
 * Checks if match has invalid empty nested content (negative length)
 */
function hasInvalidNestedContent(match: Match): boolean {
	if (!match.descriptor.hasNested) return false
	if (match.gaps.nested === undefined) return false
	return match.gaps.nested.end - match.gaps.nested.start < 0
}

/**
 * Checks if match is valid nesting inside existing match's nested section
 */
function isValidNesting(match: Match, existing: Match): boolean {
	if (!existing.descriptor.hasNested) return false
	if (existing.gaps.nested === undefined) return false
	return match.start >= existing.gaps.nested.start && match.end <= existing.gaps.nested.end
}

/**
 * Stack node structure for tree building
 */
interface StackNode {
	match: Match
	children: Token[]
	textPos: number
}

/**
 * Finalizes a stack node by creating a mark token and adding it to the target
 * Handles both parent and root-level token placement
 *
 * @param node - Stack node to finalize
 * @param input - Original input text
 * @param stack - Current stack (used to determine parent context)
 * @param result - Root result array
 * @param currentTextPosition - Current text position in root context
 * @returns Updated currentTextPosition if at root level, otherwise undefined
 */
function finalizeStackNode(
	node: StackNode,
	input: string,
	stack: StackNode[],
	result: Token[],
	currentTextPosition: number
): number {
	const bounds = getContentBounds(node.match)

	// Add remaining text in mark (always, even if empty)
	node.children.push(createTextToken(input, node.textPos, bounds.end))

	// Create token
	const token = createMarkToken(input, node.match, node.children)

	// Determine target: parent's children or root tokens
	const hasParent = stack.length > 0
	const targetTokens = hasParent ? stack[stack.length - 1].children : result
	const targetPos = hasParent ? stack[stack.length - 1].textPos : currentTextPosition

	// Add text before token (always, even if empty)
	targetTokens.push(createTextToken(input, targetPos, token.position.start))
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
 * Filters matches using O(N) single-pass algorithm
 * Handles duplicates, overlaps, and invalid content
 */
function filterMatches(matches: Match[]): {
	filteredMatches: Match[]
	lastProcessedStartPosition: number
	lastAcceptedMatch: Match | null
} {
	let lastProcessedStartPosition = -1
	let lastAcceptedMatch: Match | null = null
	const filteredMatches: Match[] = []

	for (const match of matches) {
		// Skip empty matches with invalid nested content
		if (hasInvalidNestedContent(match)) {
			continue
		}

		// Skip duplicate matches at the same start position (keep only first)
		// PatternMatcher already sorts by priority, so first is best
		if (match.start === lastProcessedStartPosition) {
			continue
		}

		// Check for overlaps with last accepted match
		if (lastAcceptedMatch && match.start < lastAcceptedMatch.end) {
			// Check if this is valid nesting inside lastAcceptedMatch
			if (isValidNesting(match, lastAcceptedMatch)) {
				// Valid nesting - accept this match and update tracking
				lastProcessedStartPosition = match.start
				lastAcceptedMatch = match
				filteredMatches.push(match)
			} else {
				// Invalid overlap - reject this match
				lastProcessedStartPosition = match.start
				continue
			}
		} else {
			// No overlap - accept this match
			lastProcessedStartPosition = match.start
			lastAcceptedMatch = match
			filteredMatches.push(match)
		}
	}

	return { filteredMatches, lastProcessedStartPosition, lastAcceptedMatch }
}

/**
 * Closes completed parents that don't contain the current match
 */
function closeCompletedParents(
	stack: StackNode[],
	match: Match,
	input: string,
	result: Token[],
	currentTextPosition: number
): number {
	let position = currentTextPosition

	while (stack.length > 0) {
		const top = stack[stack.length - 1]
		const bounds = getContentBounds(top.match)

		if (bounds.end <= match.start) {
			// Pop before finalizing (so stack.length reflects parent context)
			const node = stack.pop()!
			position = finalizeStackNode(node, input, stack, result, position)
		} else {
			break
		}
	}

	return position
}

/**
 * Adds a match to the stack for potential children processing
 */
function addMatchToStack(stack: StackNode[], match: Match): void {
	const bounds = getContentBounds(match)
	stack.push({
		match,
		children: [],
		textPos: bounds.start,
	})
}

/**
 * Finalizes all remaining marks in the stack
 */
function finalizeRemainingStack(
	stack: StackNode[],
	input: string,
	result: Token[],
	currentTextPosition: number
): number {
	let position = currentTextPosition

	while (stack.length > 0) {
		const node = stack.pop()!
		position = finalizeStackNode(node, input, stack, result, position)
	}

	return position
}

/**
 * Builds nested token tree with O(N) inline filtering
 *
 * Algorithm:
 * 1. Process pre-sorted matches from PatternMatcher
 * 2. Apply O(N) single-pass filtering for overlaps and duplicates
 * 3. Use stack-based tree building to construct nested structure
 * 4. Close completed parents when current match is not inside their nested content
 * 5. Finalize remaining stack at the end
 *
 * Optimizations:
 * - Matches arrive pre-sorted by position from PatternMatcher
 * - Single-pass O(N) filtering using lastMatch tracking
 * - Extract substrings from input on demand (no intermediate MatchResult)
 * - Stack-based tree building without recursion
 *
 * Complexity: O(N) where N is number of matches
 *
 * @param input - Original input text
 * @param matches - Pre-sorted match states from PatternMatcher
 * @returns Nested token tree
 */
export function buildTree(matches: Match[], input: string): Token[] {
	if (matches.length === 0) {
		return [createTextToken(input, 0, input.length)]
	}

	const result: Token[] = []
	const stack: StackNode[] = []
	let currentTextPosition = 0

	// Filter matches using O(N) single-pass algorithm
	const { filteredMatches } = filterMatches(matches)

	for (const match of filteredMatches) {
		// Close completed parents that don't contain this match
		currentTextPosition = closeCompletedParents(stack, match, input, result, currentTextPosition)

		// Skip matches that start before current root position
		// This handles cases where patterns find matches inside already-processed content
		if (stack.length === 0 && match.start < currentTextPosition) {
			continue
		}

		// Add this match to the stack for potential children
		addMatchToStack(stack, match)
	}

	// Finalize all remaining marks in stack
	currentTextPosition = finalizeRemainingStack(stack, input, result, currentTextPosition)

	// Add final text after all marks (always, even if empty)
	result.push(createTextToken(input, currentTextPosition, input.length))

	return result
}
