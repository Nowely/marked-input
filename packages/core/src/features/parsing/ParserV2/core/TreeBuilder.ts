import {TextToken, MarkToken, Token} from '../types'
import {MatchState} from './PatternProcessor'

/**
 * Helper structure for tracking parent marks during tree building
 */
interface MarkNode {
	match: MatchState
	children: Token[]
	textPos: number // Current position for adding text tokens
	hasNestedMarks: boolean // Track if any nested marks were added (optimization)
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
 * Uses pre-computed hasNestedMarks flag for efficiency
 * Extracts substrings from input on demand
 */
function createMarkToken(input: string, match: MatchState, children: Token[], hasNestedMarks: boolean): MarkToken {
	// Extract value content from input
	const value =
		match.valueStart !== undefined && match.valueEnd !== undefined
			? input.substring(match.valueStart, match.valueEnd)
			: ''

	// Extract nested content from input
	const nested =
		match.nestedStart !== undefined && match.nestedEnd !== undefined
			? input.substring(match.nestedStart, match.nestedEnd)
			: undefined

	// Extract meta content from input
	const meta =
		match.metaStart !== undefined && match.metaEnd !== undefined
			? input.substring(match.metaStart, match.metaEnd)
			: undefined

	// Priority: use value if present, otherwise use nested content
	// This handles combined patterns like @[__value__](__nested__) correctly
	const valueContent = value !== '' ? value : nested || ''

	// Store nested content information for debugging
	const nestedInfo = nested
		? {
				content: nested,
				start: match.nestedStart!,
				end: match.nestedEnd!,
			}
		: undefined

	return {
		type: 'mark',
		content: input.substring(match.start, match.end),
		children: hasNestedMarks ? children : [],
		descriptor: match.descriptor,
		value: valueContent,
		meta,
		position: {start: match.start, end: match.end},
		nested: nestedInfo,
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
 * Optimized to minimize redundant checks
 */
function finalizeMarkNode(node: MarkNode, ctx: TreeBuildContext): void {
	// Add any remaining text in this mark's nestable content
	// Priority: use nested end if present, otherwise use value end
	const contentEnd = node.match.nestedEnd !== undefined ? node.match.nestedEnd : (node.match.valueEnd ?? node.match.start)
	addTextToken(ctx.input, node.children, node.textPos, contentEnd)

	const token = createMarkToken(ctx.input, node.match, node.children, node.hasNestedMarks)
	
	const stackLen = ctx.stack.length
	if (stackLen > 0) {
		// Add to parent's children
		const parent = ctx.stack[stackLen - 1]
		addTextToken(ctx.input, parent.children, parent.textPos, node.match.start)
		parent.children.push(token)
		parent.textPos = node.match.end
		parent.hasNestedMarks = true // Mark parent as having nested marks
	} else {
		// Add to root
		addTextToken(ctx.input, ctx.rootTokens, ctx.rootTextPos, node.match.start)
		ctx.rootTokens.push(token)
		ctx.rootTextPos = node.match.end
	}
}

/**
 * Pops completed parent marks from stack and finalizes them
 * Optimized to minimize function calls and checks
 */
function popCompletedParents(match: MatchState, ctx: TreeBuildContext): void {
	let stackLen = ctx.stack.length
	while (stackLen > 0) {
		const parent = ctx.stack[stackLen - 1]

		// Check if current match is inside parent's nestable content (nested or value gap)
		// Inline the isContainedInNestableContent check for performance
		const parentMatch = parent.match
		let isContained: boolean
		if (parentMatch.nestedStart !== undefined && parentMatch.nestedEnd !== undefined) {
			isContained = match.start >= parentMatch.nestedStart && match.end <= parentMatch.nestedEnd
		} else {
			const valueStart = parentMatch.valueStart ?? parentMatch.start
			const valueEnd = parentMatch.valueEnd ?? parentMatch.start
			isContained = match.start >= valueStart && match.end <= valueEnd
		}

		if (isContained) {
			// This match is nested inside parent
			break
		}

		// Parent is complete - finalize it
		ctx.stack.pop()
		finalizeMarkNode(parent, ctx)
		stackLen--
	}
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
		let shouldFilter = false

		// Pre-filter: Skip TRULY empty matches (nested content has negative length)
		const matchDesc = match.descriptor
		if (matchDesc.hasNested && match.nestedStart !== undefined && match.nestedEnd !== undefined) {
			const nestedLength = match.nestedEnd - match.nestedStart
			if (nestedLength < 0) {
				shouldFilter = true
				continue
			}
		}

		for (const existing of filtered) {
			// Case 1: Same start position - keep only the longest (first due to sort)
			if (match.start === existing.start) {
				shouldFilter = true
				break
			}

			// Case 2: Match is completely inside existing
			if (match.start >= existing.start && match.end <= existing.end) {
				// If strictly inside (not sharing boundaries), it might be valid nesting
				if (match.start > existing.start || match.end < existing.end) {
					// Check if match is inside existing's nested content (valid nesting)
					const existingDesc = existing.descriptor
					
					if (
						existingDesc.hasNested &&
						existing.nestedStart !== undefined &&
						existing.nestedEnd !== undefined &&
						match.start >= existing.nestedStart &&
						match.end <= existing.nestedEnd
					) {
						// Valid nesting - match is inside existing's __nested__ section
						// Keep both (don't filter)
						continue
					}
					
					// Filter to be safe
					shouldFilter = true
					break
				} else {
					// Same boundaries - filter the shorter/weaker one (already handled by sort)
					shouldFilter = true
					break
				}
			}

			// Case 3: Partial overlap (neither fully contains the other)
			// Keep the one that started first
			const matchesOverlap =
				match.start < existing.end &&
				match.end > existing.start && // They overlap
				!(match.start >= existing.start && match.end <= existing.end) && // match not inside
				!(existing.start >= match.start && existing.end <= match.end) // existing not inside

			if (matchesOverlap) {
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
export function buildTree(input: string, matches: MatchState[]): Token[] {
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
		// Priority: use nested start if present, otherwise use value start
		const contentStart = match.nestedStart !== undefined ? match.nestedStart : (match.valueStart ?? match.start)
		ctx.stack.push({
			match,
			children: [],
			textPos: contentStart,
			hasNestedMarks: false,
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
