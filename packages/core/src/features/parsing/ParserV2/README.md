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
import { ParserV2 } from './ParserV2'

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

**Benchmark Results (nested structures):**

| Depth | Operations/sec |
|-------|----------------|
| 1 | 65,710 ops/sec |
| 2 | 40,092 ops/sec |
| 3 | 47,923 ops/sec |

**Characteristics:**
- **Complexity**: O(N log N) for nested parsing (sorting + single-pass building)
- **Algorithm**: Single-pass tree building + Aho-Corasick multi-pattern matching
- **Memory**: O(N) space complexity (no duplicate parsing)

## Architecture

### Core Components

```typescript
type MarkputToken = TextToken | MarkToken

interface MarkToken {
  type: 'mark'
  content: string
  children: MarkputToken[]    // Nested tokens
  optionIndex: number         // Markup descriptor index
  value: string               // Text between segments
  meta?: string               // Additional metadata
  position: { start: number, end: number }
}
```

### Module Structure

```
ParserV2/
├── ParserV2.ts              # Main parser class
├── ParserV2.bench.ts        # Performance benchmarks
├── ParserV2.spec.ts         # Tests
├── README.md                # Documentation and parser rules
├── index.ts                 # Public exports
├── types.ts                 # Types and interfaces
├── core/                    # Core functionality
│   ├── MarkupDescriptor.ts  # Markup descriptor creation
│   ├── PatternProcessor.ts  # Pattern processing coordinator
│   ├── ChainMatcher.ts      # Pattern chain building
│   ├── MatchValidator.ts    # Match validation and filtering
│   ├── MatchPostProcessor.ts # Conversion to MatchResult
│   ├── TokenBuilder.ts      # Token creation
│   └── TreeBuilder.ts       # Single-pass tree building
└── utils/                   # Utilities
    ├── MarkupRegistry.ts    # Descriptor registry + deduplicated segments
    ├── AhoCorasick.ts       # Efficient multi-pattern search (uses deduplicated segments)
    ├── PatternBuilder.ts    # Pattern building from chains
    ├── PatternSorting.ts    # Static sorting methods
    └── PatternChainManager.ts # Active chain management
```

## Visualization

### MarkputToken Structure

```typescript
// Simple token tree
"Hello @[world](test) and #[tag]"
     ↓
[
  TextToken("Hello ", 0, 6),
  MarkToken("@[world](test)", 6, 20, data={meta:"world", meta:"test"}, children=[]),
  TextToken(" and ", 20, 25),
  MarkToken("#[tag]", 25, 31, data={meta:"tag"}, children=[]),
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
  MarkToken("@[hello #[world]]", 0, 17, data={meta:"hello #[world]"}, children=[
    TextToken("hello ", 2, 8),
    MarkToken("#[world]", 8, 16, data={meta:"world"}, children=[
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
match.start = 0, match.end = 15      // substring(0, 15) = "@[world](test)"
match.labelStart = 2, match.labelEnd = 7  // substring(2, 7) = "world"
match.valueStart = 9, match.valueEnd = 14 // substring(9, 14) = "test"
```

### Algorithm Flow

```
Input Text → Aho-Corasick → SegmentMatches
                              ↓
                    PatternProcessor
                    (coordinator)
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   ChainMatcher      MatchValidator       PriorityResolver
   (build chains)    (validate+filter)    (sort)
        │                     │                     │
        └─────────────────────┴─────────────────────┘
                              ↓
                   Validated PatternMatches
                              ↓
                   MatchPostProcessor
                   (convert to MatchResult)
                              ↓
                       MatchResults
                              ↓
                TreeBuilder (single-pass)
                - Stack-based parent-child detection
                - Position containment check
                              ↓
                      MarkputToken[]
```

### Separation of Responsibilities

**PatternProcessor** - minimal coordinator (only 3 lines of logic):
- `ChainMatcher` - build pattern chains from segments
- `MatchValidator` - validation and match filtering
- `PatternSorting` - static sorting methods

**ChainMatcher** - complete chain building logic isolation:
- Creates `PatternBuilder` and `PatternChainManager` internally
- Processes waiting chains with `PatternSorting.sortWaitingChains()`
- Starts new chains with `PatternSorting.sortDescriptors()`
- Tracks nesting via `nestingStack`

**PatternSorting** - static sorting methods:
- `sortWaitingChains()` - prioritize chains during expansion
- `sortDescriptors()` - prioritize patterns at start
- `sortPatternMatches()` - final sorting for tree building

**MatchValidator** - five-stage filtering pipeline:
1. Filter matches inside non-nested gaps (`__meta__`, `__value__`)
2. Filter conflicts of same descriptor at same position
3. Materialize gaps from text
4. Filter partial matches (with shared boundaries)
5. Validate two `__value__` for HTML-like patterns

**MatchPostProcessor** - conversion to final format:
- Extract content (value, nested, meta)
- Create `MatchResult[]` with positions

## API

### Core Parser

```typescript
class ParserV2 {
  constructor(markups: Markup[])
  split(input: string): MarkputToken[]
}

// Static method
ParserV2.split(input: string, markups: Markup[]): MarkputToken[]
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
import { annotate } from '@markput/core'

// Simple value
annotate('@[__value__]', { value: 'Hello' })
// Returns: '@[Hello]'

// Value with meta
annotate('@[__value__](__meta__)', { value: 'Hello', meta: 'world' })
// Returns: '@[Hello](world)'

// Nested content
annotate('@[__nested__]', { nested: 'Hello #[world]' })
// Returns: '@[Hello #[world]]'

// HTML-like with all placeholders
annotate('<__value__ __meta__>__nested__</__value__>', {
  value: 'div',
  meta: 'class',
  nested: 'Content'
})
// Returns: '<div class>Content</div>'
```

#### denote

Transform annotated text by recursively processing all tokens (including nested ones).

```typescript
import { denote } from '@markput/core'

function denote(
  value: string,
  callback: (mark: MarkToken) => string,
  ...markups: Markup[]
): string
```

**Examples:**

```typescript
import { denote } from '@markput/core'

const text = '@[Hello](world) and #[nested @[content]]'

// Extract all values recursively
denote(
  text,
  mark => mark.value,
  '@[__value__](__meta__)',
  '#[__nested__]'
)
// Returns: 'Hello and nested content'

// Extract meta values
denote(
  '@[user](Alice) mentioned @[user](Bob)',
  mark => mark.meta || mark.value,
  '@[__value__](__meta__)'
)
// Returns: 'Alice mentioned Bob'

// Custom transformation
denote(
  '@[Hello](world) and @[Bye](test)',
  mark => `[${mark.value}: ${mark.meta}]`,
  '@[__value__](__meta__)'
)
// Returns: '[Hello: world] and [Bye: test]'
```

#### toString

Convert parsed tokens back to annotated string (inverse of `split`).

```typescript
import { toString } from '@markput/core'

function toString(
  tokens: MarkputToken[],
  markups: Markup[]
): string
```

**Examples:**

```typescript
import { ParserV2, toString } from '@markput/core'

const markups = ['@[__value__](__meta__)', '#[__nested__]']
const text = '@[Hello](world) #[test]'

// Parse and reconstruct
const tokens = new ParserV2(markups).split(text)
const reconstructed = toString(tokens, markups)

console.log(reconstructed === text) // true

// Useful for round-trip transformations
const modified = tokens.map(token => {
  if (token.type === 'mark') {
    return { ...token, value: token.value.toUpperCase() }
  }
  return token
})
const result = toString(modified, markups)
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
match.start = 0, match.end = 15  // substring(0, 15) = "@[world](test)"

// Label positions:
match.labelStart = 2, match.labelEnd = 7  // substring(2, 7) = "world"

// Value positions:
match.valueStart = 9, match.valueEnd = 14  // substring(9, 14) = "test"
```

#### Token Structure
```typescript
TextToken: { type: 'text', content, position: {start, end} }
MarkToken: { type: 'mark', content, children: [], optionIndex, value, meta?, position: {start, end} }
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
"@[](__meta__)"  // Error: Must have at least one "__meta__" or "__nested__" placeholder

// ❌ Too many __nested__ placeholders
"@[__nested__](__nested__)"  // Error: Expected 0 or 1 "__nested__" placeholder, but found 2

// ❌ Too many __meta__ placeholders
"@[__meta__](__meta__)(__meta__)"  // Error: Expected 0 or 1 "__meta__" placeholder, but found 2

// ❌ No static segments
"__meta__"  // Error: Must have at least one static segment
```

**Valid combination examples:**
```typescript
// ✅ Combination of __meta__ and __nested__
"@[__meta__](__nested__)"  // value for identification, nested for nested content

// ✅ Combination of __meta__ and __meta__
"@[__meta__](__meta__)"   // value for identification, value for simple value

// ✅ Combination of __nested__ and __meta__
"@[__nested__](__meta__)"  // nested content and simple value

// ✅ HTML-like with label, value, and nested
"<__meta__ __meta__>__nested__</__meta__>"  // full HTML-like tag with attributes and content

// ✅ Value before content placeholder
"(__meta__)@[__meta__]"   // value can be in any position
"[__meta__](__meta__)(__nested__)"  // value between value and nested
```

#### Trigger and Symmetry
- **Trigger** = first character of first segment (used for grouping)
- **Symmetric pattern** = first and last segments are identical (`**text**`, `*text*`)

### 3. Match Finding Algorithm

#### Segment Matching (Aho-Corasick)
- All static segments from all patterns are deduplicated in `MarkupRegistry`
- **Aho-Corasick** algorithm finds all segment occurrences in text
- Result: `SegmentMatch[]` - found segments with positions and indices
- **Complexity:** O(N + M), where N = text length, M = pattern count

#### Pattern Building (Chain Management)
- **Pattern Chain** = chain of segments forming one pattern
- Chain is created when **first segment** of pattern is found
- Chain is extended when **next segments** are found
- Chain is completed when **last segment** is found

#### Pattern Priority Rules

**When starting new chain:**
- **Longer first segments** have priority (avoid conflicts `*` vs `**`)
- If equal length - **more segments** = higher priority (more specific patterns first)

**When extending/completing chain:**
- **Chains completing at current segment** have priority (close first)
- **Chains without nesting** have priority (close first)
- **Lookahead**: if next segment is immediately available - prioritize expansion
- **For chains with same start position** (conflicting):
  - **More collected segments** = higher priority (more specific pattern)
  - If equal - **more total segments** = higher priority
- All else equal: **LIFO** - later started = higher priority (nested)

#### Pattern Exclusivity
- Pattern **cannot** start new match while its chain is active
- Example: `@[simple]` and `@[simple](value)` cannot be active simultaneously
- Short pattern, when completed, **cancels** longer one with same start position

#### Overlap Filtering
After building all matches, remove:
- **Partial matches** - matches that are part of longer match with same start/end
- **Matches inside __meta__** - matches inside value section of another match
- **Matches inside __meta__** - matches inside label section of another match (values don't support nesting)
- **Overlapping matches** - conflicting matches of same descriptor starting at same position

Preserve:
- **Nested matches** in __nested__ sections (for tree building)

#### Advanced Algorithm Details

**Lazy Gap Materialization:**
```typescript
// Gaps in PatternMatch are initially undefined for memory optimization
part.value === undefined  // not yet materialized

// Materialization occurs when needed:
if (part.start > part.end) {
  part.value = ''  // empty gap (adjacent segments)
} else {
  part.value = input.slice(part.start, part.end + 1)
}
```

**Non-Nested Gap Filtering Strategy:**
Matches inside `__meta__` and `__meta__` sections are filtered because they're treated as plain text.
Only `__nested__` sections support nesting:
```typescript
// Check: does matchB start inside non-nested gap (value or label) of matchA?
for (const part of matchA.parts) {
  if (part.type === 'gap' && (part.gapType === 'value' || part.gapType === 'label')) {
    if (matchB.start >= part.start && matchB.start <= part.end) {
      // matchB is filtered - it's inside non-nested gap
    }
  }
  // If gapType === 'nested', nesting is allowed
}
```

**Nesting Stack Management:**
PatternProcessor uses LIFO stack to track active chains:
```typescript
const nestingStack: PatternChain[] = []

for (const match of uniqueMatches) {
  // 1. Process completed chains
  processWaitingChains(match, results, nestingStack)

  // 2. Start new chains
  startNewChains(match, results, nestingStack)
}
```
Chains are managed by "last in - first out" principle for correct nesting handling.

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
- **__nested__ sections support nesting**: matches inside `__nested__` are preserved and form tree
- **__meta__ and __meta__ sections are not parsed**: matches inside these sections are ignored
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
- ❌ **Parsing inside __meta__** - value is treated as plain text
- ❌ **Parsing inside __meta__** - value is treated as plain text (use `__nested__` for nesting)
- ❌ **Bracket counting** - pattern closes at first closing segment

#### __nested__ vs __meta__
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
Input:  "Hello @[world](test)"
Markup: "@[__meta__](__meta__)"
Output: [
  TextToken("Hello ", 0, 6),
  MarkToken("@[world](test)", 6, 20, children=[], data={meta:"world", meta:"test"}),
  TextToken("", 20, 20)
]
```

#### Nesting (with __nested__)
```typescript
Input:  "@[hello #[world]]"
Markups: ["@[__nested__]", "#[__nested__]"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[hello #[world]]", 0, 17, children=[
    TextToken("hello ", 2, 8),
    MarkToken("#[world]", 8, 16, children=[], data={meta:"world"}),
    TextToken("", 16, 16)
  ], data={meta:"hello #[world]"}),
  TextToken("", 17, 17)
]
```

#### No Nesting (with __meta__)
```typescript
Input:  "@[hello #[world]]"
Markups: ["@[__meta__]", "#[__meta__]"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[hello #[world]]", 0, 17, children=[], data={meta:"hello #[world]"}),
  TextToken("", 17, 17)
]
// Note: children is empty, #[world] remains as plain text in label
```

#### HTML-Like Patterns with Two Values
```typescript
Input:  "Check <img>photo.jpg</img> image"
Markup: "<__meta__>__meta__</__meta__>"
Output: [
  TextToken("Check ", 0, 6),
  MarkToken("<img>photo.jpg</img>", 6, 26, children=[], data={meta:"img", meta:"photo.jpg"}),
  TextToken(" image", 26, 32)
]
```

#### Combined Pattern (__meta__ and __nested__)
```typescript
Input:  "@[user](Hello #[world])"
Markups: ["@[__meta__](__nested__)", "#[__nested__]"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[user](Hello #[world])", 0, 23, children=[
    TextToken("Hello ", 7, 13),
    MarkToken("#[world]", 13, 21, children=[], data={meta:"world"}),
    TextToken("", 21, 21)
  ], data={meta:"user"}),
  TextToken("", 23, 23)
]
// Note: value="user" identifies token, nested content contains nested markup
```

#### HTML-Like Pattern with Label, Value, and Nested
```typescript
Input:  "<div class>Content with **bold**</div>"
Markups: ["<__meta__ __meta__>__nested__</__meta__>", "**__nested__**"]
Output: [
  TextToken("", 0, 0),
  MarkToken("<div class>Content with **bold**</div>", 0, 39, children=[
    TextToken("Content with ", 11, 24),
    MarkToken("**bold**", 24, 32, children=[], data={meta:"bold"}),
    TextToken("", 32, 32)
  ], data={meta:"div", meta:"class"}),
  TextToken("", 39, 39)
]
// HTML-like markup with attribute (value) and nested formatted content
```

#### Value Before Content Placeholder
```typescript
Input:  "(url)@[link]"
Markup: "(__meta__)@[__meta__]"
Output: [
  TextToken("", 0, 0),
  MarkToken("(url)@[link]", 0, 12, children=[], data={meta:"link", meta:"url"}),
  TextToken("", 12, 12)
]
// Value can appear before value - order is not restricted
```

#### Validation of Matching Opening and Closing Tags
```typescript
Input:  "<div1>text</div2>"
Markup: "<__meta__>__nested__</__meta__>"
Output: [
  TextToken("<div1>text</div2>", 0, 17)
]
// Does NOT match - opening tag "div1" doesn't match closing tag "div2"
// Patterns with two __meta__ require identical labels
```

#### Adjacent Marks
```typescript
Input:  "@[first](1)@[second](2)"
Markups: ["@[__meta__](__meta__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[first](1)", 0, 11, children=[], data={meta:"first", meta:"1"}),
  TextToken("", 11, 11),
  MarkToken("@[second](2)", 11, 23, children=[], data={meta:"second", meta:"2"}),
  TextToken("", 23, 23)
]
```

#### Empty Values and Values
```typescript
Input:  "@[] @[content] @[label]() @[another](value)"
Markups: ["@[__meta__]", "@[__meta__](__meta__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[]", 0, 3, children=[], data={meta:""}),  // empty label
  TextToken(" ", 3, 4),
  MarkToken("@[content]", 4, 14, children=[], data={meta:"content"}),
  TextToken(" ", 14, 15),
  MarkToken("@[label]()", 15, 25, children=[], data={meta:"label", meta:""}),  // empty value
  TextToken(" ", 25, 26),
  MarkToken("@[another](value)", 26, 42, children=[], data={meta:"another", meta:"value"}),
  TextToken("", 42, 42)
]
```

#### Symmetric Patterns (Markdown-style)
```typescript
Input:  "**bold text** and *italic text*"
Markups: ["**__meta__**", "*__meta__*"]
Output: [
  TextToken("", 0, 0),
  MarkToken("**bold text**", 0, 13, children=[], data={meta:"bold text"}),
  TextToken(" and ", 13, 19),
  MarkToken("*italic text*", 19, 33, children=[], data={meta:"italic text"}),
  TextToken("", 33, 33)
]
```

## Conflicting Pattern Examples

ParserV2 uses a complex priority system to resolve conflicts between patterns that can match at the same text segment.

### Core Priority Principles

1. **More specific patterns first**: Patterns with more segments get priority
2. **Progress matters**: Chains with more collected segments are prioritized
3. **Longer segments matter**: Patterns with longer initial segments avoid conflicts
4. **LIFO for nesting**: Later (inner) patterns get priority

### Conflict Examples

#### Conflicting Patterns (Shorter Wins)
```typescript
Input:  "@[simple] @[with](value)"
Markups: ["@[__meta__]", "@[__meta__](__meta__)"]
Output: [
  TextToken("", 0, 0),
  MarkToken("@[simple]", 0, 9, children=[], data={meta:"simple"}),
  TextToken(" ", 9, 10),
  MarkToken("@[with]", 10, 17, children=[], data={meta:"with"}),  // short pattern without value
  TextToken("(value)", 17, 24)  // remaining text
]
```

#### Priority by Segment Count
```typescript
Input:  "<div class><p>Text</p></div>"
Markups: [
  "<__meta__>__nested__</__meta__>",        // 4 segments
  "<__meta__ __meta__>__nested__</__meta__>" // 5 segments - higher priority
]
Output: [
  TextToken("", 0, 0),
  MarkToken("<div class><p>Text</p></div>", 0, 28, children=[
    TextToken("", 11, 11),
    MarkToken("<p>Text</p>", 11, 22, children=[], data={meta:"p"}),
    TextToken("", 22, 22)
  ], data={meta:"div", meta:"class"}),
  TextToken("", 28, 28)
]
// Pattern with 5 segments gets priority over pattern with 4 segments
```

#### Conflict with Same Start Position
```typescript
Input:  "<div class><p>Text</p></div>"
Markups: [
  "<__meta__ __meta__>__nested__</__meta__>", // 5 segments, 2 collected at start
  "<__meta__>__nested__</__meta__>"           // 4 segments, 1 collected at start
]
Output: [
  TextToken("<div class>", 0, 11),
  MarkToken("<p>Text</p>", 11, 22, children=[], data={meta:"p"}),
  TextToken("</div>", 22, 28)
]
// Pattern with more collected segments (2) gets priority over pattern with 1 collected segment
```

#### Conflict Resolution with Same Progress
```typescript
Input:  "**bold**"
Markups: [
  "**__meta__**",  // 3 segments
  "*__meta__*"     // 3 segments (symmetric)
]
Output: [
  TextToken("", 0, 0),
  MarkToken("**bold**", 0, 8, children=[], data={meta:"bold"}),
  TextToken("", 8, 8)
]
// With equal progress, first pattern from list is chosen
```

### Recommendations for Working with Conflicts

- **Place more specific patterns before general ones**: Patterns with `__meta__` or more segments should come first
- **Use `__nested__` for nested content**: This allows creating hierarchical structure
- **Use `__meta__` for simple text**: When nesting is not needed
- **Test pattern order**: When adding new markup rules, verify how they interact with existing ones
- **Document priorities**: In complex applications, document pattern order for future developers
