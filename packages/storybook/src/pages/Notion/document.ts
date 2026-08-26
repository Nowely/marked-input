/**
 * THE SHOWCASE DOCUMENT — the page of `docs/scratch/notion-like/showcase.md`, written as the
 * value a user's editor holds.
 *
 * Every line here is a ROW. Its first bytes are what types it, an indented line is a child of the
 * line above it, and nothing in this string is a hint to a component: what the page paints is
 * decided by `notion/`'s kinds alone.
 *
 * Written as a template literal with real tabs, because the tab IS the indent unit — a document
 * that spells its nesting with spaces gets neither nesting nor a kind on those lines, which is
 * declared behaviour rather than a bug to work around here.
 */
export const APOLLO_DOC = `@title Apollo — Q2 launch plan
@properties
Status: chip:amber:In progress
Owner: person:Kara Vance
Team: people:Kara Vance;Ines Duarte;Milo Freeman;Priya Raman;Tomas Alvarez;Wen Li
Timeline: Apr 8 → Jun 30
Tags: chip:blue:Platform, chip:purple:Design, Q2
Spec: link:apollo/spec https://example.com/apollo/spec
Confidence: 82%
@end
---
Apollo moves the collaboration layer from beta to general availability. Ownership sits with @[Platform](team-platform), and ==launch gating on the auth migration== is what everything downstream assumes.
@toc
Launch tasks
	Sprint board
	Metrics & risks
Decision log
@end
## Launch tasks
@caption Inline database · 24 items
@views Table|Board|Timeline|Calendar
|= Task | Status | Owner | Due | Effort
| Auth service migration | <status:Blocked> | <who:Kara Vance> | <due:2026-04-02> | <bar:0.2>
| Realtime sync engine | <status:In progress> | <who:Milo Freeman> | <due:2026-04-18> | <bar:0.6>
| Pricing page rewrite | <status:Done> | <who:Ines Duarte> | <due:2026-03-27 done> | <bar:1>
| Load test at 5× peak | <status:Planned> | <who:Priya Raman> | <due:2026-05-06> | <bar:0>
| Vendor SLA sign-off | <status:At risk> | <who:Tomas Alvarez> | <due:2026-04-09> | <bar:0.35>
|+ Count 24 · 9 done
## Sprint board
@board
To do
- Sign the vendor SLA|red:Legal
- EU region quota|blue:Infra
- Launch copy review
In progress
- Auth migration|purple:Platform
- p95 latency budget|amber:Perf
Shipped
- Beta invites|green:Growth
@end
## Metrics & risks
@metrics
Beta users|4,120
p95 latency|184ms
Crash-free|99.4%
Open bugs|37
@end
> [!danger] Launch gating on the auth migration — GA holds only if cutover lands by 2026-04-09.
### Risks
- Vendor SLA unsigned
- EU region capacity unconfirmed
	- Awaiting quota approval
- Support headcount at 60%
- [ ] Confirm the EU quota with the vendor
- [x] Signed off by Platform
## Decision log
▾ Why we cut the Android target
	Shipping three platforms at once puts the auth migration on the critical path twice.
	1. Auth migration owns the critical path.
	1. Three platforms at once doubles the QA matrix.
▸ Single-region GA first
	EU capacity is unconfirmed, so a second region is a launch risk with no launch benefit.
▸ Adopt CRDT over OT
	Presence and offline edits fall out of the same merge; OT needed a server for each.
## Canary procedure
\`\`\`bash
apollo deploy --env=staging --canary=5%
# → rollout 5% · healthy · p95 184ms
\`\`\`
> If the cutover isn't boring, we're not ready to call it GA.
@bookmark(https://example.com/apollo/auth-migration|How the auth migration changes token lifetimes, and what breaks if it slips.) Auth migration — rollout plan
@comments
Kara Vance|2h ago|Can we confirm the EU quota before Friday?
Milo Freeman|41m ago|Asked the vendor this morning — expecting an answer tomorrow.
@end
`