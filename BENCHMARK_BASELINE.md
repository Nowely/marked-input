# Baseline Performance - ParserV2 Before Optimizations

Date: 2025-10-06
Branch: nested-marks

## Critical Issue: Recursive Re-parsing

ParserV2 is significantly slower than ParserV1 on nested structures due to recursive label parsing in `createMarkToken`.

## Benchmark Results

### Nested Structure Performance: v1 vs v2

#### Shallow Nesting (depth: 1, marks: 5)
- Parser v1 (flat): **698,154 ops/sec** (0.0014ms avg)
- Parser v2 (nested): **1,849 ops/sec** (0.5409ms avg)
- **377x slower** ❌

#### Medium Nesting (depth: 2, marks: 5)
- Parser v1 (flat): **316,270 ops/sec** (0.0032ms avg)
- Parser v2 (nested): **530 ops/sec** (1.8863ms avg)
- **597x slower** ❌

#### Deep Nesting (depth: 3, marks: 3)
- Parser v1 (flat): **342,837 ops/sec** (0.0029ms avg)
- Parser v2 (nested): **455 ops/sec** (2.1988ms avg)
- **754x slower** ❌

## Test Cases

```typescript
// Shallow: depth=1, marks=5
"Start #[tag0 @[user0_0](User 0_0)] #[tag1 @[user1_0](User 1_0)] ..."

// Medium: depth=2, marks=5
"Start #[tag0 @[user0_0](User 0_0) @[user0_1](User 0_1)] ..."

// Deep: depth=3, marks=3
"Start #[tag0 @[user0_0](User 0_0) @[user0_1](User 0_1) @[user0_2](User 0_2)] ..."
```

## Root Cause

In `TokenBuilder.ts:13-28`, each mark's label is re-parsed recursively:

```typescript
const createMarkToken = (parser: ParserV2, match: MatchResult): MarkToken => {
  const innerTokens = match.label ? parser.split(match.label) : []  // 🔴 Full re-parse!
  // ...
}
```

This means:
- Depth 1: Text parsed 1x + each label parsed again = 2x total
- Depth 2: 2x from above + nested labels = 4x total
- Depth 3: 4x from above + nested labels = 8x total

**Complexity: O(N × 2^D)** where D = nesting depth

## Planned Optimizations

1. **Problem #5**: Remove BaseMarkupDescriptor duplication
2. **Problem #2**: Add empty token constant
3. **Problem #4**: Single-pass tree building with position tracking → **Target: O(N) complexity**

Expected improvement: **100-500x faster** for nested structures

