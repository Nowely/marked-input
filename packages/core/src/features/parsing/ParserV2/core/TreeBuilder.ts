import {TextToken, MarkToken, MatchResult, NestedToken} from '../types'

/**
 * Helper structure for tracking parent marks during tree building
 */
interface MarkNode {
	match: MatchResult
	children: NestedToken[]
	textPos: number  // Current position for adding text tokens
}

/**
 * Creates a text token for a range in the input
 */
function createTextToken(input: string, start: number, end: number): TextToken {
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
function createMarkToken(match: MatchResult, children: NestedToken[]): MarkToken {
	// Check if there are any nested marks (not just text tokens)
	const hasNestedMarks = children.some(child => child.type === 'mark')
	
	return {
		type: 'mark',
		content: match.content,
		children: hasNestedMarks ? children : [],
		data: {
			label: match.label,
			value: match.value,
			optionIndex: match.descriptorIndex
		},
		position: { start: match.start, end: match.end }
	}
}

/**
 * Adds text token between positions (always adds, even if empty)
 * This maintains compatibility with the old behavior where empty text tokens are always present
 */
function addTextToken(
	input: string,
	tokens: NestedToken[],
	fromPos: number,
	toPos: number
): void {
	tokens.push(createTextToken(input, fromPos, toPos))
}

/**
 * Determines if matchB is contained within matchA's label
 * Note: match.end is exclusive, labelEnd is inclusive
 */
function isContainedInLabel(matchB: MatchResult, matchA: MatchResult): boolean {
	// matchB must start at or after label start, and end at or before label end + 1 (since labelEnd is inclusive)
	return matchB.start >= matchA.labelStart && matchB.end <= matchA.labelEnd + 1
}

/**
 * Builds nested token tree in a single pass without recursive parsing
 * 
 * Algorithm:
 * 1. Sort matches by position (already done by PatternMatcher)
 * 2. Use a stack to track parent-child relationships
 * 3. For each match, determine if it's nested within previous matches
 * 4. Build tree structure while maintaining text tokens
 * 
 * Complexity: O(N) where N is number of matches
 */
export function buildTreeSinglePass(
	input: string,
	matches: MatchResult[]
): NestedToken[] {
	if (matches.length === 0) {
		return [createTextToken(input, 0, input.length)]
	}

	const rootTokens: NestedToken[] = []
	const stack: MarkNode[] = []
	let rootTextPos = 0

	for (const match of matches) {
		// Find the appropriate parent for this match
		// Pop stack until we find a parent that contains this match in its label
		while (stack.length > 0) {
			const parent = stack[stack.length - 1]
			
			// Check if current match is inside parent's label
			if (isContainedInLabel(match, parent.match)) {
				// This match is nested inside parent
				break
			} else {
				// Parent is complete - finalize it
				const completed = stack.pop()!
				
				// Add any remaining text in parent's label
				// Note: labelEnd is inclusive, so we need to add 1 to include the last character
				addTextToken(
					input,
					completed.children,
					completed.textPos,
					completed.match.labelEnd + 1
				)
				
				const token = createMarkToken(completed.match, completed.children)
				
				if (stack.length > 0) {
				// Add to parent's children
				const newParent = stack[stack.length - 1]
				addTextToken(input, newParent.children, newParent.textPos, completed.match.start)
				newParent.children.push(token)
				newParent.textPos = completed.match.end
				} else {
					// Add to root
					addTextToken(input, rootTokens, rootTextPos, completed.match.start)
					rootTokens.push(token)
					rootTextPos = completed.match.end
				}
			}
		}
		
		// Add this match to the stack
		stack.push({
			match,
			children: [],
			textPos: match.labelStart
		})
	}
	
	// Finalize all remaining marks in stack
	while (stack.length > 0) {
		const completed = stack.pop()!
		
		// Add any remaining text in this mark's label
		// Note: labelEnd is inclusive, so we need to add 1 to include the last character
		addTextToken(
			input,
			completed.children,
			completed.textPos,
			completed.match.labelEnd + 1
		)
		
		const token = createMarkToken(completed.match, completed.children)
		
		if (stack.length > 0) {
			// Add to parent's children
			const parent = stack[stack.length - 1]
			addTextToken(input, parent.children, parent.textPos, completed.match.start)
			parent.children.push(token)
			parent.textPos = completed.match.end
		} else {
			// Add to root
			addTextToken(input, rootTokens, rootTextPos, completed.match.start)
			rootTokens.push(token)
			rootTextPos = completed.match.end
		}
	}
	
	// Add final text after all marks
	addTextToken(input, rootTokens, rootTextPos, input.length)
	
	return rootTokens
}

