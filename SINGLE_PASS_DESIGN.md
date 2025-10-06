# Single-Pass Tree Building Algorithm Design

## Problem
Current implementation does recursive re-parsing:
- Each `MatchResult.label` is re-parsed via `parser.split(match.label)`
- Complexity: O(N × 2^D) where D = nesting depth
- Performance: 377-754x slower than flat parsing

## Solution: Single-Pass Tree Building

### Key Insight
All matches are already found by `PatternMatcher.getAllMatches()`. We just need to organize them into a tree based on their positions in the **original text**.

### Algorithm

```typescript
/**
 * Builds nested token tree in a single pass
 * Uses stack-based approach to track parent-child relationships
 */
function buildTreeSinglePass(
  input: string,
  matches: MatchResult[]
): NestedToken[] {
  
  // 1. Sort matches by start position, then by span (longest first)
  const sorted = matches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    return (b.end - b.start) - (a.end - a.start) // longer matches first
  })
  
  // 2. Build parent-child relationships based on containment
  const tree = []
  const stack = [] // Stack of {match, children, labelStart, labelEnd}
  
  for (const match of sorted) {
    // Pop stack until we find a parent that contains this match
    while (stack.length > 0) {
      const parent = stack[stack.length - 1]
      
      // Check if match is inside parent's label
      if (match.start >= parent.labelStart && match.end <= parent.labelEnd) {
        // match is a child of parent
        break
      } else {
        // parent is complete, pop it
        const completed = stack.pop()
        const token = createMarkTokenDirect(completed)
        
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(token)
        } else {
          tree.push(token)
        }
      }
    }
    
    // Calculate label boundaries in original text
    const labelStart = calculateLabelStart(match)
    const labelEnd = calculateLabelEnd(match)
    
    // Add match to stack
    stack.push({
      match,
      children: [],
      labelStart,
      labelEnd
    })
  }
  
  // Pop remaining stack
  while (stack.length > 0) {
    const completed = stack.pop()
    const token = createMarkTokenDirect(completed)
    
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(token)
    } else {
      tree.push(token)
    }
  }
  
  // 3. Fill gaps with text tokens
  return fillGapsWithTextTokens(input, tree)
}
```

### Challenge: Label Position Tracking

The current `MatchResult` doesn't track label positions in original text:

```typescript
interface MatchResult {
  start: number  // Start of entire match
  end: number    // End of entire match
  label: string  // Extracted label string (not positions!)
  value?: string
}
```

**Problem**: We know `@[hello](world)` spans [0-15], but we don't know where `hello` is in original text.

### Solution A: Add Label Positions to MatchResult

```typescript
interface MatchResult {
  start: number
  end: number
  content: string
  label: string
  labelStart: number  // NEW: Position in original text
  labelEnd: number    // NEW: Position in original text
  value?: string
  valueStart?: number // NEW: Position in original text
  valueEnd?: number   // NEW: Position in original text
  descriptorIndex: number
}
```

This requires changes in `PatternMatcher.extractContent()` to track positions, not just extract strings.

### Solution B: Reconstruct Positions from Segments

Use `PatternMatch.parts` (MatchSegment[]) to calculate label positions:
- parts[0] = first segment (e.g., "@[")
- parts[1] = first gap (label)
- parts[2] = second segment (e.g., "](")
- parts[3] = second gap (value)
- parts[4] = third segment (e.g., ")")

Label position = parts[1].start to parts[1].end

**Pros**: No need to change MatchResult
**Cons**: Need to pass PatternMatch or recalculate from MatchResult

### Solution C: Include PatternMatch in MatchResult

```typescript
interface MatchResult {
  // ... existing fields
  patternMatch: PatternMatch  // NEW: Keep reference to original match
}
```

Then we can extract label positions from `patternMatch.parts`.

## Recommended Approach

**Solution A** - Add explicit position tracking to MatchResult.

**Rationale**:
1. Clean API - positions are explicit
2. No extra overhead - we're already extracting the strings
3. Makes debugging easier - can see exact positions
4. Future-proof - useful for other features (syntax highlighting, etc.)

## Implementation Steps

1. Update `MatchResult` interface to include labelStart/labelEnd
2. Update `PatternMatcher.extractContent()` to track positions
3. Implement `buildTreeSinglePass()` function
4. Replace recursive `parser.split()` call with direct tree building
5. Add comprehensive tests for nested structures

## Expected Performance

- Complexity: O(N log N) for sorting + O(N) for tree building = **O(N log N)**
- Current: O(N × 2^D)
- Improvement: **100-1000x faster** for nested structures

## Edge Cases to Handle

1. Empty labels: `#[]`
2. Adjacent marks: `@[a]@[b]`
3. Overlapping marks (already handled by PatternMatcher)
4. Deep nesting (5+ levels)
5. Multiple marks at same position

