# `PropsModel.update` accepts inherited keys

Status: ready-for-agent

`features/state/PropsModel.ts:80`:

```ts
for (const [key, value] of Object.entries(values)) {
    if (key in this) setters[key](value)
}
```

`'set' in this` is true — it is a prototype method — and so are `update`, `constructor` and `toString`. A runtime caller passing one of those names reaches `setters[key](value)`, which invokes the method as if it were a prop signal. Compile-time `Partial<SignalValues<typeof this>>` keeps typed callers safe; runtime input is broader.

Fix: replace `key in this` with a check against the model's own signal keys — the same `Object.keys(this)` set that `set` iterates — rather than the prototype chain.
Risk: behavior-change (small) — silently drops non-signal keys instead of executing them.

Carried from the 2026-05-23 core audit, where the same defect was reported against `set`. `set` was rewritten since (it now iterates `Object.keys(this)`, its own enumerable fields, so the prototype cannot leak in) and the guard survives only in `update`.
