# 03 — Describe the React adapter's subscription as it is

Status: needs-triage
Blocked by: 01

**What to build:** the development docs' architecture page describes how the React adapter
subscribes to the store as the code does it — a `computed` read through `useSyncExternalStore`,
watched on subscribe — instead of the effect-and-`untracked` shape it still describes. Blocked by
01 because that ticket changes where the hook keeps its subscription, and the page should describe
the shape that ships.

- [ ] The architecture page's description of the adapter's store hook matches the code
- [ ] The website build passes
