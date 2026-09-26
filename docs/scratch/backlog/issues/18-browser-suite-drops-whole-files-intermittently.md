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

## Comments

2026-09-26 — back on Vitest 5.0.2 during the dependency update, and this time the output was
kept. One full `pnpm test` run lost 16 files, all in the react project and none in vue:
`Base/{MarkputHandle,rowDefault,rowKinds,rowKinds.react,rowNesting,surface,sweep}`, `Clipboard`,
`Drag`, `Nested`, `Notion/{scale.react,structure}`, `Slots`, `htmlSnapshot`, `stories`,
`stories.react`. Paths shortened, hashes elided:

```
Error: Failed to import test file packages/storybook/vitest.setup.react.ts
 ❯ runSetupFiles node_modules/.vite/vitest/<hash>/deps/plugins.<hash>.js:5528:35
 ❯ node_modules/.vite/vitest/<hash>/deps/plugins.<hash>.js:5556:6
 ❯ collectTests node_modules/.vite/vitest/<hash>/deps/plugins.<hash>.js:5538:3
 ❯ startTests node_modules/.vite/vitest/<hash>/deps/plugins.<hash>.js:6213:17

Caused by: SyntaxError: Illegal return statement
 Test Files  16 failed | 107 passed (123)
```

That is the whole of it: the stack stops in Vitest's own runner, as Vite pre-bundled it into
`node_modules/.vite/vitest/`, and names no frame of the setup file. The immediate rerun was green;
it hit 1 of the 18 full runs of that update.
