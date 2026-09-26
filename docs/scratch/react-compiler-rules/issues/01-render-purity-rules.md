# 01 — Turn the render-purity rules back on

Status: needs-triage
Blocked by: None — can start immediately

**What to build:** `react/refs`, `react/immutability` and `react/globals` are enabled again and lint
stays green, with no change in what the editor does. The adapter's store hook stops reading a ref
during render, `MarkedInput` keeps its `ref` out of the props it hands the store, and the React
spec harness publishes the echoed value after commit. The two sites that are right as written —
the write to the consumer's object ref in the container's callback ref, and the scale spec's
render counter — carry an exception that states the contract it keeps.

Triage first: decide whether the adapter should follow the React Compiler's rules at all (see the
spec's options). The handling per site and a working prototype are in the spec.

- [ ] The three rules are removed from the `TODO(react-compiler)` block in the oxlint config
- [ ] `pnpm run lint:check` passes with no new suppression beyond the two reasoned exceptions
- [ ] The five checks pass, and the store hook still creates its subscription once per component
- [ ] The React spec harness's `value()` still reports the last value echoed to the editor
