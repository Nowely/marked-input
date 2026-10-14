# The Notion slash-menu spec runs out of time under coverage

Status: needs-info

`Notion/Notion.spec.ts` › "the slash menu" › "inserts a block that paints something, for every
entry it offers" failed in both projects of one `pnpm run test:coverage` run on 2026-09-25, on
Vitest 4.1.11:

```
TimeoutError: locator.click: Timeout 18ms exceeded.
 ❯ focusAtStart packages/storybook/src/shared/lib/focus.ts:46:17
 ❯ packages/storybook/src/pages/Notion/Notion.spec.ts:443:9
```

It passed in the other 17 full runs of that dependency update: the next coverage run, a coverage
run on Vitest 5, and all 15 plain runs. An 18 ms click timeout reads as what was left of the test's
own budget — the test walks every entry the menu offers, and coverage slows each step — but that is
a hypothesis: the run kept no durations.

Needs a measurement before it is a task: the test's duration under coverage against its timeout. If
it runs close to the limit, choose between one test per entry and a longer timeout for this one.

## Comments

**2026-10-13, Vite+ migration branch** (Vitest 5.0.3 via `vite-plus`, Chromium 141 in a 4-core
container): the same test failed in both projects of one PLAIN `pnpm test` run, no coverage, with
`locator.click: Timeout 142ms` (react) and `289ms` (vue) at the same `focusAtStart` line, after
14.95 s. Run alone (`-t "for every entry it offers"`), it takes 4.27 s (vue) and 4.30 s (react)
against the 15 s budget. The next full run passed. So the suite's load is enough, not only coverage:
a 3.5× slowdown on a loaded machine eats the whole budget. That favours one test per entry over a
longer timeout: each entry would then carry its own budget instead of sharing one.
