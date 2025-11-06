import {TextToken, MarkToken, Token} from '../types'
import {MatchState} from './PatternMatcher'

/**
 * Content boundaries for a match (start and end positions)
 */
interface ContentBounds {
	start: number
	end: number
}

/**
 * Gets the content boundaries for a match
 * Priority: nested content if present, otherwise value content
 */
function getContentBounds(match: MatchState): ContentBounds {
	if (match.nestedStart !== undefined && match.nestedEnd !== undefined) {
		return {start: match.nestedStart, end: match.nestedEnd}
	}
	return {
		start: match.valueStart ?? match.start,
		end: match.valueEnd ?? match.start,
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
function createNestedInfo(match: MatchState, nested: string | undefined): MarkToken['nested'] {
	if (!nested || match.nestedStart === undefined || match.nestedEnd === undefined) {
		return undefined
	}
	return {
		content: nested,
		start: match.nestedStart,
		end: match.nestedEnd,
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
function createMarkToken(input: string, match: MatchState, children: Token[]): MarkToken {
	// Extract content using helper functions
	const value = extractSubstring(input, match.valueStart, match.valueEnd)
	const nestedStr = extractSubstring(input, match.nestedStart, match.nestedEnd)
	const metaStr = extractSubstring(input, match.metaStart, match.metaEnd)

	// Convert empty strings to undefined for nested, but meta can be empty string
	const nested = nestedStr || undefined
	const meta = match.metaStart !== undefined && match.metaEnd !== undefined ? metaStr : undefined

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
function hasInvalidNestedContent(match: MatchState): boolean {
	if (!match.descriptor.hasNested) return false
	if (match.nestedStart === undefined || match.nestedEnd === undefined) return false
	return match.nestedEnd - match.nestedStart < 0
}

/**
 * Checks if match is valid nesting inside existing match's nested section
 */
function isValidNesting(match: MatchState, existing: MatchState): boolean {
	if (!existing.descriptor.hasNested) return false
	if (existing.nestedStart === undefined || existing.nestedEnd === undefined) return false
	return match.start >= existing.nestedStart && match.end <= existing.nestedEnd
}

/**
 * Stack node structure for tree building
 */
interface StackNode {
	match: MatchState
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
 * @param currentPos - Current position in root context
 * @returns Updated currentPos if at root level, otherwise undefined
 */
function finalizeStackNode(
	node: StackNode,
	input: string,
	stack: StackNode[],
	result: Token[],
	currentPos: number
): number {
	const bounds = getContentBounds(node.match)

	// Add remaining text in mark (always, even if empty)
	node.children.push(createTextToken(input, node.textPos, bounds.end))

	// Create token
	const token = createMarkToken(input, node.match, node.children)

	// Determine target: parent's children or root tokens
	const hasParent = stack.length > 0
	const targetTokens = hasParent ? stack[stack.length - 1].children : result
	const targetPos = hasParent ? stack[stack.length - 1].textPos : currentPos

	// Add text before token (always, even if empty)
	targetTokens.push(createTextToken(input, targetPos, token.position.start))
	targetTokens.push(token)

	// Update position
	if (hasParent) {
		stack[stack.length - 1].textPos = token.position.end
		return currentPos // No change to root position
	} else {
		return token.position.end // Update root position
	}
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
export function buildTree(matches: MatchState[], input: string): Token[] {
	if (matches.length === 0) {
		return [createTextToken(input, 0, input.length)]
	}

	const result: Token[] = []
	const stack: StackNode[] = []
	let currentPos = 0

	// Filtering state for O(N) single-pass overlap detection
	let lastRootEnd = 0 // Track the end position of the last root-level match
	let lastStart = -1 // Track last processed match start (skip duplicates at same position)
	let lastMatch: MatchState | null = null // Track last accepted match for overlap checks

	for (const match of matches) {
		// Skip empty matches with invalid nested content
		if (hasInvalidNestedContent(match)) {
			continue
		}

		// Filter: Skip duplicate matches at the same start position (keep only first)
		if (match.start === lastStart) {
			continue
		}

		// Filter: Check for overlaps with last accepted match
		if (lastMatch && match.start < lastMatch.end) {
			// Check if this is valid nesting inside lastMatch
			if (isValidNesting(match, lastMatch)) {
				// Valid nesting - accept this match and update tracking
				lastStart = match.start
				lastMatch = match // Update for deeper nesting checks
			} else {
				// Invalid overlap - reject this match
				lastStart = match.start
				continue
			}
		} else {
			// No overlap - accept this match
			lastStart = match.start
			lastMatch = match

			// Update lastRootEnd if this is at root level (not nested in previous match)
			if (match.start >= lastRootEnd) {
				lastRootEnd = match.end
			}
		}

		// Close completed parents that don't contain this match
		while (stack.length > 0) {
			const top = stack[stack.length - 1]
			const bounds = getContentBounds(top.match)

			if (bounds.end <= match.start) {
				// Pop before finalizing (so stack.length reflects parent context)
				const node = stack.pop()!
				currentPos = finalizeStackNode(node, input, stack, result, currentPos)
			} else {
				break
			}
		}

		// Skip matches that start before current root position
		// This handles cases where patterns find matches inside already-processed content
		if (stack.length === 0 && match.start < currentPos) {
			continue
		}

		// Add this match to the stack for potential children
		const bounds = getContentBounds(match)
		stack.push({
			match,
			children: [],
			textPos: bounds.start,
		})
	}

	// Finalize all remaining marks in stack
	while (stack.length > 0) {
		const node = stack.pop()!
		currentPos = finalizeStackNode(node, input, stack, result, currentPos)
	}

	// Add final text after all marks (always, even if empty)
	result.push(createTextToken(input, currentPos, input.length))

	return result
}
