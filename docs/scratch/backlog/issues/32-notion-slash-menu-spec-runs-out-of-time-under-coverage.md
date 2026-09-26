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
