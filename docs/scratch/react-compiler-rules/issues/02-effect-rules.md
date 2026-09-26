# 02 — Turn the effect rules back on

Status: needs-triage
Blocked by: None — can start immediately

**What to build:** `react/set-state-in-effect` and `react/exhaustive-effect-dependencies` are
enabled again and lint stays green. The demo app's suggestion overlay resets its highlighted item
while rendering when the trigger or query changes, so no frame paints — and no Enter picks — an
index left over from the previous list. The Rsuite story's key handler lists the callbacks it
uses. The sites that are right as written carry an exception that states the contract it keeps:
the row controls measure the DOM in layout effects and re-measure on `geometry`, the row re-asks
`rowPainted` when its kind changes under the same node, and the `markMounts` fixture logs mounts
only.

Triage first, as for 01. The handling per site and a prototype of the overlay reset are in the
spec; option 3 there keeps these two rules off for good instead.

- [ ] The two rules are removed from the `TODO(react-compiler)` block in the oxlint config
- [ ] `pnpm run lint:check` passes with no suppression beyond the reasoned exceptions listed above
- [ ] The five checks pass
- [ ] The demo overlay is checked in a browser: arrows then a narrower query, an empty result,
      and Enter after narrowing all act on the item that is highlighted
