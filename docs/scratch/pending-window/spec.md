# Removing the pending window

The maintainer's primary goal, stated 2026-08-18: *"отказ от всяких пендинг и прочего"* — get rid
of the pending window and its machinery.

Start here. Everything below is measured; nothing needs re-deriving.

## What the window is

`pendingStructural` in `features/tokens/dom/commit.ts` — a latch held between a structural apply
and its bind. While it is true, `TokenModel.handle(id)` answers `undefined`, so id-bridged reads
and mutations fail closed rather than acting on a tree the DOM never showed.

Three facts that make this much smaller than it sounds:

- **`pending()` has exactly ONE production consumer in the whole repository** — the guard line in
  `TokenModel.ts:61`. Verified by grep across core, both adapters and MarkputApi.
- **Its only externally visible effect is `handle(id)` answering `undefined`.** Gated by
  `TokenModel.spec.ts:252` and `:256`.
- **The window only exists for STRUCTURAL commits.** A text keystroke routes around it entirely:
  `apply` with `render === false` only announces, and the DOM is written by the per-Surface effect
  at **zero component renders** (`renderCount.spec.ts`). So typing never touches this machinery.

## Two routes that are dead ends — do not take them

**1. Making the parse faster does not shorten the window.** The window sits between the commit and
the bind: core commits → the framework renders → `rendered()` → bind. The parse happens *before*
the commit, on the synchronous side. Proven: the paint is asynchronous in both adapters, there is no
`flushSync` anywhere in the repo, React's bump reaches `useSyncExternalStore` on a microtask and
Vue's reaches a queued render effect; five assertions in `commitPipeline.spec.ts` (216, 290, 314,
339, 551) pin the window's existence. The whole incremental-parser branch was originally justified
by this and the justification does not hold — see
[`../incremental-parser/spec.md`](../incremental-parser/spec.md).

**2. Deleting the latch outright is not available.** The paint handshake is irreducible while the
frameworks own the document DOM ([ADR-0007](../../adr/0007-row-identity-travels-with-the-row.md),
[ADR-0002](../../adr/0002-one-contenteditable-host.md)). Proven by controlled experiment:
`@handlewithcare/react-prosemirror` takes ProseMirror's core unchanged and inverts DOM ownership so
React paints — and a fail-closed latch reappears there (`viewDescRef.current` undefined until a
layout effect, plus `if (!viewDescRef.current) return`), together with three more of markput's
concepts. Attacking the latch's existence is attacking ADR-0007.

So the goal is not to delete the window. It is to make it **unfelt**.

## Three routes that are available

Ranked by blast radius. None touches the parser.

### A. A flush-and-read escape hatch

markput has none. A consumer holding a token id during a pending window can only wait it out.
Lexical's `editor.read(cb)` defaults to `'force-commit'`, committing pending updates before it
reads. This is the one idea from the four-editor analog survey shaped like something markput
**lacks** rather than something it deliberately rejected.

Open question this must answer: what does "flush" mean when the missing step is a *framework paint*
that core cannot force? Possibly it only flushes the model side and still declines the DOM half —
in which case say so in the name.

### B. Make staleness unrepresentable instead of latched

A handle carries its generation, so a stale handle is an obviously dead object rather than a live
object suppressed by a flag consulted at one site. `TokenHandle` already has `alive()` and already
fails closed on every command; the latch exists because the *lookup* can hand back a handle whose
node the DOM never showed. Giving the handle a generation moves the check from the registry to the
object.

### C. Leave it, and fix the report instead

The window is already the best answer among framework-rendered editors. Slate — the only analog
whose DOM React renders — has the same window and answers with a **throw** at the resolver
(`Cannot resolve a DOM node from Slate node`), with a latch bolted on beside it at four opt-in
sites plus `suppressThrow` at five call sites and a bare try/catch. markput's fail-closed read was
judged better on three axes: centrality (one resolver versus N local decisions), phase alignment
(the latch clears in the same pass that fills the node layer; Slate's two halves are never fresh
together), and default direction (a defined "not yet" versus a throw at some unrelated later
keystroke).

If the objection is *complexity* rather than *behaviour*, C plus a documented contract may be the
honest answer, and it costs nothing.

## The one hard constraint

**Node WRITES must not be gated by the window.** A mid-window `MarkNode.update()` must succeed and
fold into the pending pass. Gated by `markNode.spec.ts:380-381` and `:391`. Reintroducing a write
latch is a SEMVER-MAJOR behaviour reversal, not a refactor.

Related, and already true: element-first resolution stays ungated mid-flight — `handleAt`,
`anchorFor` and `domAnchors` keep answering from the painted DOM while the tree is ahead. That is
decision S2 D4 and it is deliberate; the DOM→model direction reads the DOM, so it is never stale in
the direction that matters.

## Adjacent, and cheap, if the goal is fewer concepts

The commit pipeline holds eight concepts. Four of them — the epoch counter, this latch, `bind`'s
whole-tree walk, and Vue's two announcement sites — are the invoice for framework-owned DOM and are
not removable. Of the remaining four, exactly one is genuinely removable:

- **The delta accumulator** (`pendingDelta` + `foldDelta` + `drainDelta` + `deltaOf`) can become a
  set difference against an announced-id set, using the `treeIds` Set that `bind.ts:76` already
  builds and throws away. ~60 lines out of `commit.ts`, zero adapter files, zero published type
  shape change. Specified and parked as
  [backlog issue 28](../backlog/issues/28-announce-the-delta-as-a-set-difference.md).
- The re-entry guard, the divergence sweep's placement and the commit batch's ordering rules are
  each intrinsic — all four major analogs carry equivalents. See
  [`../token-born-edit/issues/06-concept-sweep.md`](../token-born-edit/issues/06-concept-sweep.md).

## Where the evidence lives

- Commit-pipeline census — 42 hard constraints, each with the spec that reds if violated, plus four
  designs and twelve adversarial verdicts:
  `~/.claude/projects/-Users-ruliny-Git-marked-input/artifacts/commit-pipeline-removal.md`
- The four-editor analog survey (ProseMirror, CodeMirror 6, Lexical, Slate), fact-checked against
  primary sources: this session's workflow `wf_2f9164cf-63d`.
- The arc this was originally a phase of: [`../token-born-edit/spec.md`](../token-born-edit/spec.md).
  Note that its phase ordering carries two corrections and its phase 3 was refuted by measurement.
