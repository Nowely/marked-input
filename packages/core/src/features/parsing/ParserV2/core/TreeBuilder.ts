import {TextToken, MarkToken, Token} from '../types'
import {MatchState} from './PatternProcessor'

/**
 * Helper structure for tracking parent marks during tree building
 */
interface MarkNode {
	match: MatchState
	children: Token[]
	textPos: number // Current position for adding text tokens
}

/**
 * Content boundaries for a match (start and end positions)
 */
interface ContentBounds {
	start: number
	end: number
}

/**
 * Context for tree building process
 */
interface TreeBuildContext {
	input: string
	rootTokens: Token[]
	stack: MarkNode[]
	rootTextPos: number
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
 * Checks if child match is contained within parent's nestable content
 */
function isMatchContained(child: MatchState, parent: MatchState): boolean {
	const bounds = getContentBounds(parent)
	return child.start >= bounds.start && child.end <= bounds.end
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
	
	// Only convert nested to undefined if it's empty (nested can't be empty string)
	// But meta CAN be empty string, so we check if positions exist
	const nested = nestedStr || undefined
	const meta = match.metaStart !== undefined && match.metaEnd !== undefined ? metaStr : undefined

	// Priority: use value if present, otherwise use nested content
	// This handles combined patterns like @[__value__](__nested__) correctly
	const valueContent = value !== '' ? value : nested || ''

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
 * Adds text token between positions (always adds, even if empty)
 * This maintains compatibility with the old behavior where empty text tokens are always present
 * Skips adding token if positions are invalid (fromPos > toPos)
 */
function addTextToken(input: string, tokens: Token[], fromPos: number, toPos: number): void {
	// Skip if positions would be invalid
	// This can happen when patterns overlap or are adjacent
	if (fromPos > toPos) {
		return
	}
	tokens.push(createTextToken(input, fromPos, toPos))
}

/**
 * Finalizes a completed mark node and adds it to parent or root
 */
function finalizeMarkNode(node: MarkNode, ctx: TreeBuildContext): void {
	// Add any remaining text in this mark's nestable content
	const bounds = getContentBounds(node.match)
	addTextToken(ctx.input, node.children, node.textPos, bounds.end)

	const token = createMarkToken(ctx.input, node.match, node.children)
	
	if (ctx.stack.length > 0) {
		// Add to parent's children
		const parent = ctx.stack[ctx.stack.length - 1]
		addTextToken(ctx.input, parent.children, parent.textPos, node.match.start)
		parent.children.push(token)
		parent.textPos = node.match.end
	} else {
		// Add to root
		addTextToken(ctx.input, ctx.rootTokens, ctx.rootTextPos, node.match.start)
		ctx.rootTokens.push(token)
		ctx.rootTextPos = node.match.end
	}
}

/**
 * Pops completed parent marks from stack and finalizes them
 */
function popCompletedParents(match: MatchState, ctx: TreeBuildContext): void {
	while (ctx.stack.length > 0) {
		const parent = ctx.stack[ctx.stack.length - 1]

		// Check if current match is inside parent's nestable content
		if (isMatchContained(match, parent.match)) {
			// This match is nested inside parent
			break
		}

		// Parent is complete - finalize it
		ctx.stack.pop()
		finalizeMarkNode(parent, ctx)
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
 * Checks if two matches have partial overlap (neither fully contains the other)
 */
function hasPartialOverlap(match: MatchState, existing: MatchState): boolean {
	const overlaps = match.start < existing.end && match.end > existing.start
	const matchInside = match.start >= existing.start && match.end <= existing.end
	const existingInside = existing.start >= match.start && existing.end <= match.end
	return overlaps && !matchInside && !existingInside
}

/**
 * Sorts and filters match states to prepare for tree building
 * Integrates filtering logic that was previously in PatternProcessor
 */
function sortAndFilterMatches(matches: MatchState[]): MatchState[] {
	if (matches.length === 0) return []

	// Sort: start ascending, end descending (longer first), then by segment length
	matches.sort((a, b) => {
		if (a.start !== b.start) return a.start - b.start
		if (a.end !== b.end) return b.end - a.end

		const aDesc = a.descriptor
		const bDesc = b.descriptor
		const aSegLen = aDesc.segments[0].length
		const bSegLen = bDesc.segments[0].length

		// Longer first segment first (** before *)
		if (aSegLen !== bSegLen) return bSegLen - aSegLen

		// More segments first
		return bDesc.segments.length - aDesc.segments.length
	})

	const filtered: MatchState[] = []

	for (const match of matches) {
		// Pre-filter: Skip empty matches with invalid nested content
		if (hasInvalidNestedContent(match)) {
			continue
		}

		let shouldFilter = false

		for (const existing of filtered) {
			// Case 1: Same start position - keep only the longest (first due to sort)
			if (match.start === existing.start) {
				shouldFilter = true
				break
			}

			// Case 2: Match is completely inside existing
			if (match.start >= existing.start && match.end <= existing.end) {
				// If strictly inside (not sharing boundaries), check for valid nesting
				const isStrictlyInside = match.start > existing.start || match.end < existing.end
				
				if (isStrictlyInside && isValidNesting(match, existing)) {
					// Valid nesting - keep both
					continue
				}
				
				// Otherwise filter this match
				shouldFilter = true
				break
			}

			// Case 3: Partial overlap - keep the one that started first
			if (hasPartialOverlap(match, existing)) {
				shouldFilter = true
				break
			}
		}

		if (!shouldFilter) {
			filtered.push(match)
		}
	}

	return filtered
}

/**
 * Builds nested token tree in a single pass without recursive parsing
 *
 * Algorithm:
 * 1. Sort and filter matches to remove overlaps and conflicts
 * 2. Iterate through filtered matches
 * 3. Use stack to track parent-child relationships based on position containment
 * 4. Pop completed parents when current match is not inside their label
 * 5. Add current match to stack for potential children
 * 6. Finalize remaining stack at the end
 *
 * Optimizations:
 * - Integrated filtering during tree building (one pass)
 * - Extract substrings from input on demand (no intermediate MatchResult)
 * - Track hasNestedMarks flag to avoid repeated child array scanning
 * - Cache stack.length to reduce property access
 * - Inline hot path checks to reduce function call overhead
 *
 * Complexity: O(N log N + N²) where N is number of matches (sorting + filtering)
 *
 * @param input - Original input text
 * @param matches - Raw match states from PatternProcessor
 * @returns Nested token tree
 *
 * @example
 * ```typescript
 * // Input: "@[hello #[world]]"
 * // Matches: [
 * //   { start: 0, end: 17, valueStart: 2, valueEnd: 16, ... },
 * //   { start: 8, end: 16, valueStart: 10, valueEnd: 15, ... }
 * // ]
 * // Result: [
 * //   TextToken(""),
 * //   MarkToken{ children: [TextToken("hello "), MarkToken("world"), TextToken("")] },
 * //   TextToken("")
 * // ]
 * ```
 */
export function buildTree(matches: MatchState[], input: string): Token[] {
	if (matches.length === 0) {
		return [createTextToken(input, 0, input.length)]
	}

	// Sort and filter matches
	const filtered = sortAndFilterMatches(matches)

	if (filtered.length === 0) {
		return [createTextToken(input, 0, input.length)]
	}

	const ctx: TreeBuildContext = {
		input,
		rootTokens: [],
		stack: [],
		rootTextPos: 0,
	}

	// Process each match
	const matchCount = filtered.length
	for (let i = 0; i < matchCount; i++) {
		const match = filtered[i]
		
		// Pop completed parents that don't contain this match
		popCompletedParents(match, ctx)

		// Check if this match would conflict with an already added match
		// Skip matches that start before or at the current root text position
		// This handles cases where patterns find matches inside already-processed content
		if (ctx.stack.length === 0 && match.start < ctx.rootTextPos) {
			// This match starts before where we currently are - skip it
			continue
		}

		// Add this match to the stack for potential children
		const bounds = getContentBounds(match)
		ctx.stack.push({
			match,
			children: [],
			textPos: bounds.start,
		})
	}

	// Finalize all remaining marks in stack (process from innermost to outermost)
	while (ctx.stack.length > 0) {
		const completed = ctx.stack.pop()!
		finalizeMarkNode(completed, ctx)
	}

	// Add final text after all marks
	addTextToken(ctx.input, ctx.rootTokens, ctx.rootTextPos, input.length)

	return ctx.rootTokens
}
