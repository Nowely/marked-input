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
 * Builds nested token tree with inline filtering and inline finalization
 *
 * Algorithm:
 * 1. Process matches with inline O(N) filtering (matches already sorted by PatternMatcher)
 * 2. Iterate through matches using stack-based tree building with inline conflict resolution
 * 3. Close completed parents when current match is not inside their nested content
 * 4. Add matches to stack for potential children with proper positioning
 * 5. Finalize remaining stack at the end
 *
 * Optimizations:
 * - Matches arrive pre-sorted from PatternMatcher (no sorting needed)
 * - Inline single-pass O(N) filtering with conflict resolution
 * - Extract substrings from input on demand (no intermediate MatchResult)
 * - Stack-based tree building without recursion
 * - Inline finalization without separate functions
 * - Proper token positioning without final sorting
 *
 * Complexity: O(N) where N is number of matches (linear filtering + linear tree building)
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
	const stack: Array<{match: MatchState; children: Token[]; textPos: number}> = []
	let currentPos = 0

	// Inline filtering state (from filterMatchesSinglePass)
	let lastRootEnd = 0 // Track the end position of the last root-level match
	let lastStart = -1 // Track the start position of the last processed match
	let lastMatch: MatchState | null = null // Track the last accepted match for nesting checks

	for (const match of matches) {
		// Inline filtering: Skip empty matches with invalid nested content
		if (hasInvalidNestedContent(match)) {
			continue
		}

		// Inline filtering: Skip matches at the same start position (keep only the first one)
		if (match.start === lastStart) {
			continue
		}

		// Inline filtering: Check if this match overlaps with the last accepted match
		if (lastMatch && match.start < lastMatch.end) {
			// If it's valid nesting - accept it
			if (isValidNesting(match, lastMatch)) {
				lastStart = match.start
				lastMatch = match // Update for potential deeper nesting
			} else {
				// Any other overlap - reject this match
				lastStart = match.start
				continue
			}
		} else {
			// This is a valid root-level match or doesn't overlap
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
				// Inline finalization: add remaining text in mark (always, even if empty)
				top.children.push(createTextToken(input, top.textPos, bounds.end))

				// Create token
				const token = createMarkToken(input, top.match, top.children)

				// Determine target: parent's children or root tokens
				const hasParent = stack.length > 1 // After pop will be length - 1
				const targetTokens = hasParent ? stack[stack.length - 2].children : result
				const targetPos = hasParent ? stack[stack.length - 2].textPos : currentPos

				// Add text before token (always, even if empty)
				targetTokens.push(createTextToken(input, targetPos, token.position.start))
				targetTokens.push(token)

				// Update position
				if (hasParent) {
					stack[stack.length - 2].textPos = token.position.end
				} else {
					currentPos = token.position.end
				}

				stack.pop()
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
		const bounds = getContentBounds(node.match)

		// Add remaining text in mark (always, even if empty)
		node.children.push(createTextToken(input, node.textPos, bounds.end))

		// Create token
		const token = createMarkToken(input, node.match, node.children)

		// Determine target
		const hasParent = stack.length > 0
		const targetTokens = hasParent ? stack[stack.length - 1].children : result
		const targetPos = hasParent ? stack[stack.length - 1].textPos : currentPos

		// Add text before token (always, even if empty)
		targetTokens.push(createTextToken(input, targetPos, token.position.start))
		targetTokens.push(token)

		// Update position
		if (hasParent) {
			stack[stack.length - 1].textPos = token.position.end
		} else {
			currentPos = token.position.end
		}
	}

	// Add final text after all marks (always, even if empty)
	result.push(createTextToken(input, currentPos, input.length))

	return result
}
