import {TextToken, MarkToken, MatchResult, Token} from '../types'

/**
 * Helper structure for tracking parent marks during tree building
 */
interface MarkNode {
	match: MatchResult
	children: Token[]
	textPos: number  // Current position for adding text tokens
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
		position: { start, end }
	}
}

/**
 * Creates a mark token from match and collected children
 * Only includes children if there are actual nested marks
 */
function createMarkToken(match: MatchResult, children: Token[]): MarkToken {
	// Check if there are any nested marks (not just text tokens)
	const hasNestedMarks = children.some(child => child.type === 'mark')

	// Priority: use value if present, otherwise use nested content
	// This handles combined patterns like @[__value__](__nested__) correctly
	const valueContent = match.value !== '' ? match.value : (match.nested || '')

	// Store nested content information for debugging
	const nestedInfo = match.nested ? {
		content: match.nested,
		start: match.nestedStart!,
		end: match.nestedEnd!
	} : undefined

	return {
		type: 'mark',
		content: match.content,
		children: hasNestedMarks ? children : [],
		optionIndex: match.descriptorIndex,
		value: valueContent,
		meta: match.meta,
		position: { start: match.start, end: match.end },
		nested: nestedInfo
	}
}

/**
 * Adds text token between positions (always adds, even if empty)
 * This maintains compatibility with the old behavior where empty text tokens are always present
 * Skips adding token if positions are invalid (fromPos > toPos)
 */
function addTextToken(
	input: string,
	tokens: Token[],
	fromPos: number,
	toPos: number
): void {
	// Skip if positions would be invalid
	// This can happen when patterns overlap or are adjacent
	if (fromPos > toPos) {
		return
	}
	tokens.push(createTextToken(input, fromPos, toPos))
}

/**
 * Determines if matchB is contained within matchA's nestable content.
 * Priority: nested gap (if present), otherwise value gap.
 * All positions are exclusive (end points to next char after last)
 */
function isContainedInNestableContent(matchB: MatchResult, matchA: MatchResult): boolean {
	// Priority: use nested gap if present, otherwise use value gap
	// This handles both pure __nested__ patterns and combined __value__/__nested__ patterns
	if (matchA.nestedStart !== undefined && matchA.nestedEnd !== undefined) {
		return matchB.start >= matchA.nestedStart && matchB.end <= matchA.nestedEnd
	}
	
	// Fallback to value for patterns that don't have __nested__
	return matchB.start >= matchA.valueStart && matchB.end <= matchA.valueEnd
}

/**
 * Finalizes a completed mark node and adds it to parent or root
 */
function finalizeMarkNode(node: MarkNode, ctx: TreeBuildContext): void {
	// Add any remaining text in this mark's nestable content
	// Priority: use nested end if present, otherwise use value end
	const contentEnd = node.match.nestedEnd !== undefined ? node.match.nestedEnd : node.match.valueEnd
	addTextToken(ctx.input, node.children, node.textPos, contentEnd)
	
	const token = createMarkToken(node.match, node.children)
	
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
function popCompletedParents(match: MatchResult, ctx: TreeBuildContext): void {
	while (ctx.stack.length > 0) {
		const parent = ctx.stack[ctx.stack.length - 1]
		
		// Check if current match is inside parent's nestable content (nested or value gap)
		if (isContainedInNestableContent(match, parent.match)) {
			// This match is nested inside parent
			break
		}
		
		// Parent is complete - finalize it
		const completed = ctx.stack.pop()!
		finalizeMarkNode(completed, ctx)
	}
}

/**
 * Builds nested token tree in a single pass without recursive parsing
 * 
 * Algorithm:
 * 1. Iterate through sorted matches (PatternMatcher already sorted them)
 * 2. Use stack to track parent-child relationships based on position containment
 * 3. Pop completed parents when current match is not inside their label
 * 4. Add current match to stack for potential children
 * 5. Finalize remaining stack at the end
 * 
 * @complexity O(N) where N is number of matches
 * @param input - Original input text
 * @param matches - Sorted matches with position tracking
 * @returns Nested token tree
 * 
 * @example
 * ```typescript
 * // Input: "@[hello #[world]]"
 * // Matches: [
 * //   { start: 0, end: 17, label: "hello #[world]", labelStart: 2, labelEnd: 16 },
 * //   { start: 8, end: 16, label: "world", labelStart: 10, labelEnd: 15 }
 * // ]
 * // Result: [
 * //   TextToken(""),
 * //   MarkToken{ children: [TextToken("hello "), MarkToken("world"), TextToken("")] },
 * //   TextToken("")
 * // ]
 * ```
 */
export function buildTree(
	input: string,
	matches: MatchResult[]
): Token[] {
	if (matches.length === 0) {
		return [createTextToken(input, 0, input.length)]
	}

	const ctx: TreeBuildContext = {
		input,
		rootTokens: [],
		stack: [],
		rootTextPos: 0
	}

	// Process each match
	for (const match of matches) {
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
		const contentStart = match.nestedStart !== undefined ? match.nestedStart : match.valueStart
		ctx.stack.push({
			match,
			children: [],
			textPos: contentStart
		})
	}
	
	// Finalize all remaining marks in stack
	while (ctx.stack.length > 0) {
		const completed = ctx.stack.pop()!
		finalizeMarkNode(completed, ctx)
	}
	
	// Add final text after all marks
	addTextToken(ctx.input, ctx.rootTokens, ctx.rootTextPos, input.length)
	
	return ctx.rootTokens
}

