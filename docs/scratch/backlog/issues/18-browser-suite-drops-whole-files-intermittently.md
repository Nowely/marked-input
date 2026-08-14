# The browser suite drops whole files intermittently

Status: needs-info

`pnpm test` intermittently loses entire spec files to a collection error, not a test failure:

```
Error: Failed to import test file packages/storybook/vitest.setup.vue.ts
Caused by: SyntaxError: Unexpected token '}'
Test Files  5 failed | 68 passed (73)
```

`vitest.setup.vue.ts` is five valid lines and is not modified. The victim files differ between
runs and both projects have been hit, which reads as a transform or cache race under
parallelism rather than a defect in any spec.

Pre-existing, and measured as such: it reproduced on clean `HEAD` in 1 of 3 consecutive runs
(5 suites lost) and on a working tree in 2 of 6. It is not caused by the test-suite cleanup —
that was the reason for measuring it.

Cost: a green run proves less than it should, and CI can fail for no reason. Needs a
diagnosis before it can be a task — whether it is vitest's transform cache, the browser
provider, or the two projects sharing a Vite server. Worth capturing the failing run's full
stderr next time it appears, since the message above is all the current runs give.
