# React Compiler lint rules

oxlint 1.79.0 (2026-08-18) split its single `react/react-compiler` rule (added in 1.70.0) into one
rule per React Compiler check, each filed under a category. Five of them land in categories
`oxlint.config.ts` enables wholesale (`correctness`, `suspicious`, both as `warn`), and
`denyWarnings` turns every warning into a failure. Upgrading oxlint from 1.76 to 1.85 therefore
surfaced 17 findings that 1.76 never reported.

**Decision, 2026-09-26:** the five rules are `off` under `TODO(react-compiler)` in
`oxlint.config.ts`, and this folder holds what is needed to come back to them. Nothing else in
the upgrade depended on them.

## What the rules protect

They are the React Compiler's checks of the Rules of React. The compiler memoizes components and
hooks at build time, and it can only do that safely when render is pure, props and state are
never mutated in place, and refs are not read during render. The same violations also misbehave
without the compiler: StrictMode renders twice in development, and concurrent rendering may
repeat or abandon a render.

| Rule | Forbids | Why |
| --- | --- | --- |
| `react/refs` | reading or writing `ref.current` during render | a ref change does not re-render, so render shows a stale value; lazy `if (ref.current === null)` initialisation is allowed |
| `react/immutability` | mutating props, state, hook return values, outer values | change detection is by reference, so an in-place write is invisible |
| `react/globals` | reassigning module-level variables during render | render must be pure; double and abandoned renders count twice |
| `react/set-state-in-effect` | synchronous `setState` inside an effect | an extra render pass; derive during render instead. React's own docs allow it when the value is a DOM measurement in a layout effect |
| `react/exhaustive-effect-dependencies` | missing or extra effect dependencies | missing ones capture stale values; extra ones re-fire the effect needlessly |

The adapter is a library: an application's compiler leaves dependencies alone by default
(`@astrojs/react` 7: "dependencies and Astro files are excluded"), so for `@markput/react` the
rules are a render-purity check rather than a precondition of being compiled.

## The 17 findings

Classified on 2026-09-26, with the handling a Codex Astra review agreed to.

| Rule | Site | Kind | Handling |
| --- | --- | --- | --- |
| refs ×3 | adapter store hook `useMarkput` | idiomatic | keep the subscription object in a `useState` initializer instead of a lazily filled ref |
| refs ×2 | `MarkedInput` | idiomatic | split `ref` off the props before they reach the store (`PropsModel.set` reads only its own keys, so the store sees the same) |
| immutability | `Container`, write to the consumer's object ref | intentional | reasoned exception: an object ref exists to be written, and this is the callback ref, run at commit |
| immutability | React spec harness `mountEcho` | idiomatic | publish the echoed value in a layout effect: it is a committed fact |
| globals | scale spec's render counter | intentional | reasoned exception: counting render calls is the measurement |
| set-state-in-effect ×2 | `RowControls` grip and refusal boxes | intentional | reasoned exception: DOM measurement in a layout effect |
| exhaustive-effect-dependencies ×2 | `RowControls`, `geometry` | intentional | reasoned exception: `geometry` is the re-measure clock |
| exhaustive-effect-dependencies | `Row`, `Component` | intentional | reasoned exception: a turn-into swaps the kind under the same node and must re-ask `rowPainted` |
| set-state-in-effect + exhaustive-effect-dependencies | demo app suggestion overlay | real | reset the highlighted item while rendering when trigger or query change — today one frame paints, and Enter can pick, a stale index |
| exhaustive-effect-dependencies | Rsuite story | real | list `select` and `close` |
| exhaustive-effect-dependencies | `markMounts` fixture | intentional | reasoned exception: mount-only by design |

So: 2 real defects, both outside the published packages (the demo overlay, the Rsuite story); 3
idiomatic rewrites with no change in behaviour (the store hook, `MarkedInput`, the spec harness);
and 6 sites, 8 exceptions, where the code is right and the analyser cannot see why.

## Options

1. Keep all five on: fix the real and idiomatic sites, add the reasoned exceptions.
2. Keep them off (chosen for now).
3. Keep `refs`, `immutability`, `globals`; leave the two effect rules off — their adapter findings
   are all intentional, and 6 of the 8 exceptions go away.
4. Stay on oxlint 1.76 (moot: the upgrade has landed with the rules off).

## Prototype from the 2026-09-26 attempt

All 17 were cleared once, then reverted when the rules were turned off. With every fix and
exception in place, lint reported nothing and the five checks were green (123 files, 2522 tests;
one run hit the known `vitest.setup` import flake). The demo overlay was not checked in a browser.
The decision-rich parts:

```ts
// useMarkput: the same object, held by state rather than by a lazily filled ref.
// StrictMode may call the initializer twice in development; `computed` only allocates,
// and `watch` starts on subscribe.
const [{subscribe, getSnapshot}] = useState((): ExternalStore => {
	const target = selector(store)
	const derived = computed((): unknown => readSelected(target))
	return {subscribe: cb => watch(derived, cb), getSnapshot: () => derived()}
})
return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
```

```ts
// MarkedInput: `ref` is React's, not the editor's.
const {ref, ...options} = props
// ...store.props.set(options) in the initializer and in the layout effect...
useImperativeHandle(ref, () => store.handle, [store])
```

```ts
// Demo overlay: reset while rendering, storing the pair that caused it.
const [listed, setListed] = useState({trigger, query})
if (listed.trigger !== trigger || listed.query !== query) {
	setListed({trigger, query})
	setActive(0)
}
```

Review notes that shaped it: an `assignRef` helper for the container's ref write was rejected —
it hides the write from the analyser without changing its meaning; each exception states the
contract it keeps, not the linter's complaint; no dependency is read in an effect just to satisfy
the analyser, and no measurement moves into render.

## Tickets

- `issues/01-render-purity-rules.md`
- `issues/02-effect-rules.md`
- `issues/03-architecture-doc-subscription.md`
