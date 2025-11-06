# ParserV2

High-performance tree-based parser for processing nested markup constructs in text with a single-pass tree-building algorithm.

**RFC:** [Nested marks](../../../../docs/RFC.%20Nested%20marks.md) - detailed requirements and architectural decisions.

## Table of Contents

- [Quick Start](#quick-start)
- [Performance](#performance)
- [Architecture](#architecture)
- [API](#api)
- [Rules](#rules)
- [Conflicting Pattern Examples](#conflicting-pattern-examples)

## Quick Start

```typescript
import {ParserV2} from './ParserV2'

// Patterns with __meta__ - no nesting support
const simpleMarkups = ['@[__meta__](__meta__)', '#[__meta__]']
const parser = new ParserV2(simpleMarkups)

const result = parser.split('Hello @[world](test) and #[tag]')
// result: [TextToken('Hello '), MarkToken{meta: 'world', meta: 'test'}, TextToken(' and '), MarkToken{meta: 'tag'}]

// Patterns with __nested__ - supports nesting
const nestedMarkups = ['@[__nested__]', '#[__nested__]']
const nestedParser = new ParserV2(nestedMarkups)

const nestedResult = nestedParser.split('@[hello #[world]]')
// result: [TextToken(''), MarkToken{meta: 'hello #[world]', children: [...]}, TextToken('')]
```

## Performance

**Latest Benchmark Results (ParserV2 vs ParserV1):**

| Test Case | V2 vs V1 Ratio | V2 Performance | Key Improvement |
| --------- | -------------- | -------------- | --------------- |
| 10 marks | **2.22x** | 27939-61384 ops/sec | Basic patterns |
| 50 marks | **2.12x** | 18590-20513 ops/sec | State machine efficiency |
| 100 marks | **2.20x** | 8377-10354 ops/sec | O(N) filtering |
| 500 marks | **1.85x** | 1989-2028 ops/sec | Reduced allocations |
| Social media | **2.06x** | 228571-480077 ops/sec | Complex content |
| Markdown-like | **2.56x** | 285714-631712 ops/sec | **+207.1%** 🚀 |
| Code comments | **2.13x** | 303767-727273 ops/sec | **+138.7%** 🚀 |

**Overall Performance:**
- **ParserV2 is 2.25x faster** than ParserV1 on average
- **Exceptional improvements** on complex patterns (+207% on markdown-like)
- **Consistent 2x+ speedup** across all test cases
- **Memory efficiency** maintained with reduced allocations

**Key Optimizations:**
- **State machine approach** eliminates complex chain management
- **O(N) single-pass filtering** replaces multi-stage validation
- **Direct MatchState → Token pipeline** removes intermediate conversions
- **Deterministic priority system** enables efficient conflict resolution

## Architecture

### Core Components

```typescript
type Token = TextToken | MarkToken

interface MarkToken {
    type: 'mark'
    content: string
    children: Token[] // Nested tokens
    descriptor: MarkupDescriptor // Markup descriptor (replaces optionIndex)
    value: string // Text between segments
    meta?: string // Additional metadata
    nested?: { // Nested content information
        content: string
        start: number
        end: number
    }
    position: {start: number; end: number}
}
```

### Module Structure

```
ParserV2/
├── Parser.ts                # Main parser class
├── Parser.spec.ts           # Tests
├── Parser.bench.ts          # Performance benchmarks
├── README.md                # Documentation and parser rules
├── index.ts                 # Public exports
├── types.ts                 # Types and interfaces
├── constants.ts             # Constants and placeholders
├── core/                    # Core parsing logic
│   ├── MarkupDescriptor.ts  # Markup descriptor creation and validation
│   ├── PatternMatcher.ts    # State machine pattern matching
│   ├── TreeBuilder.ts       # Single-pass tree construction
│   └── TokenBuilder.ts      # Token creation utilities
└── utils/                   # Utilities
    ├── MarkupRegistry.ts    # Descriptor registry with fast lookups
    ├── AhoCorasick.ts       # Efficient multi-pattern search
    ├── toString.ts          # Token serialization
    ├── denote.ts            # Token processing with callbacks
    └── annotate.ts          # Markup template instantiation
```

## Visualization

### Token Structure

```typescript
// Simple token tree
"Hello @[world](test) and #[tag]"
     ↓
[
  TextToken("Hello ", 0, 6),
  MarkToken("@[world](test)", 6, 20, value="world", meta="test", children=[]),
  TextToken(" and ", 20, 25),
  MarkToken("#[tag]", 25, 31, value="tag", children=[]),
  TextToken("", 31, 31)
]
```

### Tree with Nesting

```typescript
// Nested structure: @[hello #[world]]
"@[hello #[world]]"
     ↓
[
  TextToken("", 0, 0),
  MarkToken("@[hello #[world]]", 0, 17, value="hello #[world]", children=[
    TextToken("hello ", 2, 8),
    MarkToken("#[world]", 8, 16, value="world", children=[
      TextToken("", 10, 10),
      // ... empty TextTokens at edges
    ]),
    TextToken("", 16, 16)
  ]),
  TextToken("", 17, 17)
]
```

### Position Semantics

```typescript
// Example: "@[world](test)"
// Indices:  012345678901234 (length 15)
// Text:     @[world](test)
// Match:    ^^^^^^^^^^^^^^^
// Label:       ^^^^^
// Value:             ^^^^

// All positions are exclusive (JavaScript convention)
;((match.start = 0), (match.end = 15)) // substring(0, 15) = "@[world](test)"
;((match.labelStart = 2), (match.labelEnd = 7)) // substring(2, 7) = "world"
;((match.valueStart = 9), (match.valueEnd = 14)) // substring(9, 14) = "test"
```

### Algorithm Flow

```
Input Text → Aho-Corasick → SegmentMatches
                              ↓
                    MarkupRegistry
                    (fast lookups by segment)
                              ↓
                    PatternMatcher
                    (state machine matching)
                              ↓
                       MatchStates
                              ↓
                TreeBuilder (single-pass)
                - O(N) overlap filtering
                - Stack-based tree construction
                - Position containment checks
                              ↓
                      Token[]
```

### Separation of Responsibilities

**MarkupRegistry** - fast pattern lookups:

- Deduplicates segments from all markup patterns
- Provides `firstSegmentsMap` for starting pattern detection
- Enables O(1) lookups for pattern initiation

**PatternMatcher** - state machine pattern matching:

- Uses two-phase approach: waiting states + completed states
- Manages `MatchState` objects with position tracking
- Implements deterministic priority system for conflict resolution
- Handles complex patterns (hasTwoValues, nested content)

**TreeBuilder** - single-pass tree construction:

- Converts `MatchState[]` to nested `Token[]` tree
- O(N) filtering with single pass through matches
- Stack-based parent-child relationship detection
- Position-based containment validation

## API

### Core Parser

```typescript
class Parser {
  constructor(markups: Markup[])
  split(input: string): Token[]
  join(tokens: Token[]): string
  denote(value: string, callback: (mark: MarkToken) => string): string
}

// Static methods
Parser.split(input: string, markups: Markup[]): Token[]
Parser.join(tokens: Token[]): string
```

### Utility Functions

#### annotate

Create annotated text from markup pattern by replacing placeholders with values.

```typescript
function annotate(
    markup: Markup,
    params: {
        value?: string
        meta?: string
        nested?: string
    }
): string
```

**Examples:**

```typescript
import {annotate} from '@markput/core'

// Simple value
annotate('@[__value__]', {value: 'Hello'})
// Returns: '@[Hello]'

// Value with meta
annotate('@[__value__](__meta__)', {value: 'Hello', meta: 'world'})
// Returns: '@[Hello](world)'

// Nested content
annotate('@[__nested__]', {nested: 'Hello #[world]'})
// Returns: '@[Hello #[world]]'

// HTML-like with all placeholders
annotate('<__value__ __meta__>__nested__</__value__>', {
    value: 'div',
    meta: 'class',
    nested: 'Content',
})
// Returns: '<div class>Content</div>'
```

#### denote

Transform annotated text by recursively processing all tokens (including nested ones).

```typescript
import {denote} from '@markput/core'

function denote(value: string, callback: (mark: MarkToken) => string, ...markups: Markup[]): string
```

**Examples:**

```typescript
import {denote} from '@markput/core'

const text = '@[Hello](world) and #[nested @[content]]'

// Extract all values recursively
denote(text, mark => mark.value, '@[__value__](__meta__)', '#[__nested__]')
// Returns: 'Hello and nested content'

// Extract meta values
denote('@[user](Alice) mentioned @[user](Bob)', mark => mark.meta || mark.value, '@[__value__](__meta__)')
// Returns: 'Alice mentioned Bob'

// Custom transformation
denote('@[Hello](world) and @[Bye](test)', mark => `[${mark.value}: ${mark.meta}]`, '@[__value__](__meta__)')
// Returns: '[Hello: world] and [Bye: test]'
```

#### toString

Convert parsed tokens back to annotated string (inverse of `split`).

```typescript
import {toString} from '@markput/core'

function toString(tokens: Token[]): string
```

**Examples:**

```typescript
import {Parser, toString} from '@markput/core'

const markups = ['@[__value__](__meta__)', '#[__nested__]']
const text = '@[Hello](world) #[test]'

// Parse and reconstruct
const tokens = new Parser(markups).split(text)
const reconstructed = toString(tokens)

console.log(reconstructed === text) // true

// Useful for round-trip transformations
const modified = tokens.map(token => {
    if (token.type === 'mark') {
        return {...token, value: token.value.toUpperCase()}
    }
    return token
})
const result = toString(modified)
// Result: '@[HELLO](world) #[TEST]'
```

## Rules

### 1. Architectural Principles

#### Single-Pass Algorithm

- **One pass** to find all matches
- **One pass** to build token tree
- **No recursive parsing** of token contents

#### Position Semantics

- All positions refer to **original text**
- **All positions follow JavaScript convention**: `start` - inclusive, `end` - **exclusive**
- Compatible with `substring(start, end)` for all position types

**Example:**

```typescript
// Text: "@[world](test)"
// Indices:  012345678901234 (length 15)

// Match positions:
;((match.start = 0), (match.end = 15)) // substring(0, 15) = "@[world](test)"

// Label positions:
;((match.labelStart = 2), (match.labelEnd = 7)) // substring(2, 7) = "world"

// Value positions:
;((match.valueStart = 9), (match.valueEnd = 14)) // substring(9, 14) = "test"
```

#### Token Structure

```typescript
TextToken: { type: 'text', content, position: {start, end} }
MarkToken: { type: 'mark', content, children: [], descriptor, value, meta?, nested?, position: {start, end} }
```

### 2. Markup Pattern Rules

#### Pattern Format

Patterns consist of **static segments** and **placeholders**:

- **Placeholders**: `__meta__`, `__value__`, and `__nested__`
- **Valid pattern examples**:
    - `@[__meta__]` - value without nesting support
    - `@[__nested__]` - content with nesting support
    - `@[__meta__](__meta__)` - value and value
    - `@[__nested__](__meta__)` - nested content and value
    - `@[__meta__](__nested__)` - value and nested content (combined pattern)
    - `<__meta__>__meta__</__meta__>` - two values (HTML-like)
    - `<__meta__ __meta__>__nested__</__meta__>` - HTML-like with nesting
    - `(__meta__)@[__meta__]` - value before content (any order allowed)

#### Pattern Validation

- `__meta__` can occur **0, 1, or 2 times**
- `__nested__` can occur **0 or 1 time**
- `__meta__` and `__nested__` **can be used together** in one pattern (e.g., `@[__meta__](__nested__)`)
- Pattern must contain **at least one** `__meta__` or `__nested__`
- `__value__` can occur **0 or 1 time**
- `__value__` **can appear in any position** - before, between, or after content placeholders
- Pattern must contain **at least one static segment**
- **For patterns with two `__meta__`** (e.g., `<__meta__>__nested__</__meta__>`): both values must be **identical**, otherwise pattern doesn't match

**Validation error examples:**

```typescript
// ❌ No content placeholder
'@[](__meta__)' // Error: Must have at least one "__meta__" or "__nested__" placeholder

// ❌ Too many __nested__ placeholders
'@[__nested__](__nested__)' // Error: Expected 0 or 1 "__nested__" placeholder, but found 2

// ❌ Too many __meta__ placeholders
'@[__meta__](__meta__)(__meta__)' // Error: Expected 0 or 1 "__meta__" placeholder, but found 2

// ❌ No static segments
'__meta__' // Error: Must have at least one static segment
```

**Valid combination examples:**

```typescript
// ✅ Combination of __meta__ and __nested__
'@[__meta__](__nested__)' // value for identification, nested for nested content

// ✅ Combination of __meta__ and __meta__
'@[__meta__](__meta__)' // value for identification, value for simple value

// ✅ Combination of __nested__ and __meta__
'@[__nested__](__meta__)' // nested content and simple value

// ✅ HTML-like with label, value, and nested
'<__meta__ __meta__>__nested__</__meta__>' // full HTML-like tag with attributes and content

// ✅ Value before content placeholder
'(__meta__)@[__meta__]' // value can be in any position
'[__meta__](__meta__)(__nested__)' // value between value and nested
```

#### Trigger and Symmetry

- **Trigger** = first character of first segment (used for grouping)
- **Symmetric pattern** = first and last segments are identical (`**text**`, `*text*`)

### 3. Match Finding Algorithm

#### Segment Matching (Aho-Corasick)

- All static segments from all patterns are deduplicated in `MarkupRegistry`
- **Aho-Corasick** algorithm finds all segment occurrences in text
- Result: `SegmentMatch[]` - found segments with positions (now **exclusive end indices**)
- **Complexity:** O(N + M), where N = text length, M = pattern count

#### State Machine Pattern Matching

**PatternMatcher** uses a state machine approach with two collections:

- **`waitingStates`** - Map<segment, MatchState[]> for patterns waiting for next segment
- **`completedStates`** - Map<startPosition, MatchState[]> for completed patterns

**Match State Structure:**
```typescript
interface MatchState {
    descriptor: MarkupDescriptor
    expectedSegmentIndex: number  // NaN for completed matches
    start: number
    end: number
    // Gap tracking fields: valueStart/End, nestedStart/End, metaStart/End
}
```

**Processing Flow:**
1. **Process waiting states** - try to advance patterns expecting current segment
2. **Start new patterns** - initiate patterns that begin with current segment
3. **Handle completion** - move completed patterns to position-indexed results

#### Priority System

**Deterministic Priority Calculation:**
```typescript
calculateDeterministicPriority(state: MatchState): number {
    const bonus = expectedIndex === descriptor.segments.length - 1 ? 10_000_000 : 0
    const firstSegmentBonus = descriptor.segments[0].length * 100_000
    const positionBonus = state.start * 1000
    const progressBonus = expectedIndex * 100
    const complexityBonus = descriptor.segments.length * 10
    return bonus + firstSegmentBonus + positionBonus + progressBonus + complexityBonus
}
```

**Priority Rules (higher = processed first):**
1. **Completion bonus** (10M): States about to complete get highest priority
2. **First segment length** (100K): Longer initial segments (e.g., `**` > `*`)
3. **Position** (1K): Later start positions (LIFO for nesting)
4. **Progress** (100): More advanced states get priority
5. **Complexity** (10): More segments = slightly higher priority

#### Special Pattern Handling

**hasTwoValues patterns** (HTML-like):
- Track first and second value occurrences separately
- Validate that both values are identical
- Rollback state if validation fails

**Gap Position Tracking:**
- **`value` gaps**: Store start/end positions for content extraction
- **`nested` gaps**: Track nested content boundaries
- **`meta` gaps**: Track metadata boundaries

#### Tree Building (O(N) Single-Pass)

**Algorithm Overview:**
```
for each match in sorted_matches:
  1. Close completed parents (match.end <= current.start)
  2. Filter overlaps using lastMatch tracking
  3. Validate nesting containment
  4. Push match to stack for children
finalize remaining stack
```

**Overlap Filtering:**
- **Skip duplicates** at same start position (keep first)
- **Reject invalid overlaps** unless valid nesting
- **Track root-level matches** for containment validation

**Nesting Validation:**
```typescript
isValidNesting(child: MatchState, parent: MatchState): boolean {
    return parent.nestedStart !== undefined &&
           parent.nestedEnd !== undefined &&
           child.start >= parent.nestedStart &&
           child.end <= parent.nestedEnd
}
```

### 4. Token Tree Building

#### Single-Pass Tree Building

Algorithm traverses sorted matches **once** using a stack:

```
for each match in sorted_matches:
  1. Pop completed parents (match not contained in their label)
  2. Skip if match starts before current position (conflict)
  3. Push match to stack for potential children

Finalize remaining stack
```

**Complexity:** O(N log N) for sorting + O(N) for building

#### Nesting Rules

- **Parent-child relationship**: child is fully contained in parent's **nestedStart..nestedEnd** (or **labelStart..labelEnd** for backward compatibility)
- \***\*nested** sections support nesting\*\*: matches inside `__nested__` are preserved and form tree
- \***\*meta** and **meta** sections are not parsed\*\*: matches inside these sections are ignored
- **Self-nesting is not supported**: pattern cannot be nested within itself

#### Children Structure

- `children` contains **alternating** TextToken and MarkToken
- Always starts and ends with TextToken (even empty ones)
- `children` is **empty array** if no nested MarkTokens (only text)

#### Text Token Positions

- TextToken is created **between** MarkTokens
- Empty TextTokens are created at boundaries (legacy compatibility)
- Positions: `{start: prevMarkEnd, end: currentMarkStart}`

### 5. Edge Cases & Guarantees

#### Edge Case Handling

- ✅ **Empty input** → `[TextToken("", 0, 0)]`
- ✅ **Text without markup** → `[TextToken(text, 0, length)]`
- ✅ **Empty label/value** → `""` (valid)
- ✅ **Adjacent marks** → correct position semantics
- ✅ **Unicode/Emoji** → full support
- ✅ **Nested brackets in content** → `@[text [with] brackets]` works

#### Not Supported

- ❌ **Self-nesting** - `@[outer @[inner]]` won't create nesting for same pattern
- ❌ **Parsing inside **meta\*\*\*\* - value is treated as plain text
- ❌ **Parsing inside **meta\*\*\*\* - value is treated as plain text (use `__nested__` for nesting)
- ❌ **Bracket counting** - pattern closes at first closing segment

#### **nested** vs **meta**

**Key difference:**

- `__meta__` - content is treated as **plain text**, nested patterns are ignored
- `__nested__` - content **supports nesting**, nested patterns are parsed

**When to use `__meta__`:**

- For simple text content without nesting
- For links, tags, labels, names
- When you need guarantee that content will be plain text

**When to use `__nested__`:**

- For formatted text (markdown, HTML)
- When nesting support is needed
- For containers with arbitrary content

**Example:**

```typescript
// ❌ With __meta__ - nesting does NOT work
const parser1 = new ParserV2(['@[__meta__]', '#[__meta__]'])
parser1.split('@[hello #[world]]')
// → [MarkToken{meta: "hello #[world]", children: []}] - no nesting

// ✅ With __nested__ - nesting works
const parser2 = new ParserV2(['@[__nested__]', '#[__nested__]'])
parser2.split('@[hello #[world]]')
// → [MarkToken{meta: "hello #[world]", children: [MarkToken{meta: "world"}]}] - has nesting
```

### 6. Examples

#### Simple Case

```typescript
Input: 'Hello @[world](test)'
Markup: '@[__value__](__meta__)'
Output: [
    TextToken('Hello ', 0, 6),
    MarkToken('@[world](test)', 6, 20, value='world', meta='test', children=[]),
    TextToken('', 20, 20),
]
```

#### Nesting (with **nested**)

```typescript
Input: '@[hello #[world]]'
Markups: ['@[__nested__]', '#[__nested__]']
Output: [
    TextToken('', 0, 0),
    MarkToken(
        '@[hello #[world]]',
        0,
        17,
        children=[
            TextToken('hello ', 2, 8),
            MarkToken('#[world]', 8, 16, value='world', children=[]),
            TextToken('', 16, 16),
        ],
        value='hello #[world]'
    ),
    TextToken('', 17, 17),
]
```

#### No Nesting (with **meta**)

```typescript
Input: '@[hello #[world]]'
Markups: ['@[__value__]', '#[__value__]']
Output: [
    TextToken('', 0, 0),
    MarkToken('@[hello #[world]]', 0, 17, value='hello #[world]', children=[]),
    TextToken('', 17, 17),
]
// Note: children is empty, #[world] remains as plain text in label
```

#### HTML-Like Patterns with Two Values

```typescript
Input: 'Check <img>photo.jpg</img> image'
Markup: '<__value__>__value__</__value__>'
Output: [
    TextToken('Check ', 0, 6),
    MarkToken('<img>photo.jpg</img>', 6, 26, value='img', meta='photo.jpg', children=[]),
    TextToken(' image', 26, 32),
]
```

#### Combined Pattern (**meta** and **nested**)

```typescript
Input: '@[user](Hello #[world])'
Markups: ['@[__meta__](__nested__)', '#[__nested__]']
Output: [
    TextToken('', 0, 0),
    MarkToken(
        '@[user](Hello #[world])',
        0,
        23,
        children=[
            TextToken('Hello ', 7, 13),
            MarkToken('#[world]', 13, 21, value='world', children=[]),
            TextToken('', 21, 21),
        ],
        value='user'
    ),
    TextToken('', 23, 23),
]
// Note: value="user" identifies token, nested content contains nested markup
```

#### HTML-Like Pattern with Label, Value, and Nested

```typescript
Input: '<div class>Content with **bold**</div>'
Markups: ['<__meta__ __meta__>__nested__</__meta__>', '**__nested__**']
Output: [
    TextToken('', 0, 0),
    MarkToken(
        '<div class>Content with **bold**</div>',
        0,
        39,
        children=[
            TextToken('Content with ', 11, 24),
            MarkToken('**bold**', 24, 32, value='bold', children=[]),
            TextToken('', 32, 32),
        ],
        value='div', meta='class'
    ),
    TextToken('', 39, 39),
]
// HTML-like markup with attribute (value) and nested formatted content
```

#### Value Before Content Placeholder

```typescript
Input: '(url)@[link]'
Markup: '(__value__)@[__value__]'
Output: [
    TextToken('', 0, 0),
    MarkToken('(url)@[link]', 0, 12, value='link', meta='url', children=[]),
    TextToken('', 12, 12),
]
// Value can appear before value - order is not restricted
```

#### Validation of Matching Opening and Closing Tags

```typescript
Input: '<div1>text</div2>'
Markup: '<__meta__>__nested__</__meta__>'
Output: [TextToken('<div1>text</div2>', 0, 17)]
// Does NOT match - opening tag "div1" doesn't match closing tag "div2"
// Patterns with two __meta__ require identical labels
```

#### Adjacent Marks

```typescript
Input: '@[first](1)@[second](2)'
Markups: ['@[__value__](__meta__)']
Output: [
    TextToken('', 0, 0),
    MarkToken('@[first](1)', 0, 11, value='first', meta='1', children=[]),
    TextToken('', 11, 11),
    MarkToken('@[second](2)', 11, 23, value='second', meta='2', children=[]),
    TextToken('', 23, 23),
]
```

#### Empty Values and Values

```typescript
Input: '@[] @[content] @[label]() @[another](value)'
Markups: ['@[__value__]', '@[__value__](__meta__)']
Output: [
    TextToken('', 0, 0),
    MarkToken('@[]', 0, 3, value='', children=[]), // empty value
    TextToken(' ', 3, 4),
    MarkToken('@[content]', 4, 14, value='content', children=[]),
    TextToken(' ', 14, 15),
    MarkToken('@[label]()', 15, 25, value='label', meta='', children=[]), // empty meta
    TextToken(' ', 25, 26),
    MarkToken('@[another](value)', 26, 42, value='another', meta='value', children=[]),
    TextToken('', 42, 42),
]
```

#### Symmetric Patterns (Markdown-style)

```typescript
Input: '**bold text** and *italic text*'
Markups: ['**__value__**', '*__value__*']
Output: [
    TextToken('', 0, 0),
    MarkToken('**bold text**', 0, 13, value='bold text', children=[]),
    TextToken(' and ', 13, 19),
    MarkToken('*italic text*', 19, 33, value='italic text', children=[]),
    TextToken('', 33, 33),
]
```

## Conflicting Pattern Examples

ParserV2 uses a deterministic priority system to resolve conflicts between patterns that can match at the same text segment.

### Core Priority Principles

1. **Completion bonus** (10M): States about to complete get highest priority
2. **First segment length** (100K): Longer initial segments (e.g., `**` > `*`) get priority
3. **Position** (1K): Later start positions get slight priority (LIFO for nesting)
4. **Progress** (100): More advanced states get priority
5. **Complexity** (10): More segments get slight priority

### Conflict Examples

#### Conflicting Patterns (Shorter Wins)

```typescript
Input: '@[simple] @[with](value)'
Markups: ['@[__value__]', '@[__value__](__meta__)']
Output: [
    TextToken('', 0, 0),
    MarkToken('@[simple]', 0, 9, value='simple', children=[]),
    TextToken(' ', 9, 10),
    MarkToken('@[with]', 10, 17, value='with', children=[]), // short pattern wins
    TextToken('(value)', 17, 24), // remaining text
]
```

#### Priority by Segment Count

```typescript
Input: '<div class><p>Text</p></div>'
Markups: [
    '<__value__>__nested__</__value__>', // 4 segments
    '<__value__ __meta__>__nested__</__value__>', // 5 segments - higher priority
]
Output: [
    TextToken('', 0, 0),
    MarkToken(
        '<div class><p>Text</p></div>',
        0,
        28,
        children=[
            TextToken('', 11, 11),
            MarkToken('<p>Text</p>', 11, 22, value='p', children=[]),
            TextToken('', 22, 22),
        ],
        value='div', meta='class'
    ),
    TextToken('', 28, 28),
]
// Pattern with 5 segments gets priority over pattern with 4 segments
```

#### Conflict with Same Start Position

```typescript
Input: '<div class><p>Text</p></div>'
Markups: [
    '<__value__ __meta__>__nested__</__value__>', // 5 segments, 2 collected at start
    '<__value__>__nested__</__value__>', // 4 segments, 1 collected at start
]
Output: [
    TextToken('<div class>', 0, 11),
    MarkToken('<p>Text</p>', 11, 22, value='p', children=[]),
    TextToken('</div>', 22, 28),
]
// Pattern with more collected segments (2) gets priority over pattern with 1 collected segment
```

#### Conflict Resolution with Same Progress

```typescript
Input: '**bold**'
Markups: [
    '**__value__**', // 3 segments
    '*__value__*', // 3 segments (symmetric)
]
Output: [
    TextToken('', 0, 0),
    MarkToken('**bold**', 0, 8, value='bold', children=[]),
    TextToken('', 8, 8),
]
// With equal progress, first pattern from list is chosen
```

### Recommendations for Working with Conflicts

- **Use longer first segments**: Patterns like `**text**` will have priority over `*text*`
- **Order patterns by specificity**: More complex patterns (more segments) should come first
- **Test pattern interactions**: Priority system is deterministic, but complex interactions may surprise you
- **Use `__nested__` for nested content**: This allows creating hierarchical structure
- **Use `__value__` for simple text**: When nesting is not needed
- **Monitor performance**: State machine approach is optimized, but complex pattern sets may need tuning
