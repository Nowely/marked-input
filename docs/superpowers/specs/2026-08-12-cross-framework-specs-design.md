# One Spec Per Page Across Frameworks

Status: validated on the `Base` page (branch `b0-own-factory`), not merged.

## Problem

Every browser-tested page is written twice: once for React, once for Vue. The two copies
assert the same behavior with the same DOM queries and drift silently.

Measured on `b0` (commit `f9ae302e`):

| | react | vue |
| --- | --- | --- |
| specs | 3 705 lines | 3 961 |
| stories | 1 425 | 992 |

Roughly 200 tests per framework. Drift already present: `Drag` 76 vs 75 tests with six
differently named cases, `Slots` 26 vs 28, `renderCount` 7 vs 6, one renamed case in
`Nested`, one Vue-only case in `Base`.

Everything after mount is framework-neutral — `page`/`userEvent` interactions plus DOM
assertions. Only five things differ: `render`, component authoring (JSX vs `h`), event prop
names (`onKeyDown`/`onKeydown`, `onFocus`+`onBlur` vs `onFocusin`+`onFocusout`), ref
semantics, and stateful harnesses (`useState` vs `ref`).

## Decision

Four files per page: one story file, one spec, two fixtures modules. Both the story file and
the spec are framework-free and are executed by **both** vitest projects; the fixtures are the
only framework code. Stories stay CSF3, declared through a small per-framework DSL.

CSF factories (CSF Next) were prototyped twice — plain, then wrapped in our own seam — and
**rejected** both times. See [Rejected: CSF factories](#rejected-csf-factories).

## Architecture

### File roles

Four files per page, under `src/pages/<Page>/`:

| File | Framework | Contains |
| --- | --- | --- |
| `<Page>.stories.ts` | none | Literal CSF meta + one `story()` per story. The whole story definition |
| `<Page>.spec.ts` | none | Every framework-neutral test |
| `<Page>.fixtures.react.tsx` | react | Story fixtures (`fixtures`) and spec fixtures (`marks`, overlays) |
| `<Page>.fixtures.vue.ts` | vue | The same catalog, same keys |

Plus, only when a page needs it: `<Page>.vue.spec.ts` / `<Page>.react.spec.tsx` for tests that
cannot exist for the other framework.

There is no shared fixtures interface. `<Page>.stories.ts` IS the contract: it is compiled
twice, once per project, so a fixtures file that drifts fails one of the two typechecks.

Shared once, under `src/shared/lib/`:

| File | Contains |
| --- | --- |
| `stories.react.ts` / `stories.vue.ts` | `component`, `PageMeta`, `Story<T>`, `story<T>(input)` |
| `page.react.tsx` / `page.vue.ts` | `composePage`, `mount`, `mountEcho`, `mountComponent`, `mountApi` |
| `page.shared.ts` | The seam's framework-free types and `assertEchoable` |

### Resolution: no aliases

A shared spec imports `./Base.fixtures`, `./Base.stories`, and `../../shared/lib/page`
without a framework segment. Each project resolves them to its own file:

- vitest — `resolve.extensions`, react `['.react.tsx', '.react.ts', …]`, vue
  `['.vue.ts', '.vue.tsx', …]`;
- tsc / vue-tsc — `moduleSuffixes`, react `['.react', '']`, vue `['.vue', '']`;
- Storybook — the same `resolve.extensions` re-applied through `viteFinal`, because
  Storybook builds with its own Vite config.

The framework segment therefore goes **last** in file names (`Base.stories.react.tsx`, not
`Base.react.stories.tsx`). Every shared spec is type-checked twice, once against each
implementation of the seam.

### The seam

```ts
createPage(storiesModule) → {
  stories,                                  // composeStories(module) — decorators preserved
  mount(Story, args?)      → {container, editor}
  mountEcho(Story, {value, mirror?, ...args}) → {container, editor, value()}
}
```

`mount` renders a composed story with overridden args; `editor` is `findEditingHost(container)`,
so a story decorator wrapping the editor in a panel does not break the lookup. `mountEcho`
is the stateful harness: it echoes `onChange` back into `value`, and with `mirror: true`
renders a `<pre>` of the current value next to the editor.

`composeStories` is kept deliberately: `vitest.setup.*.ts` register `withPlainValue` through
`setProjectAnnotations`, so composed stories carry the same decorators as in the Storybook
UI. Bypassing it would change the DOM of any story with a `plainValue` parameter.

### The story file

```ts
import {component, story, type PageMeta} from '../../shared/lib/stories'
import {fixtures} from './Base.fixtures'

export default {title: 'MarkedInput', tags: ['autodocs'], component} satisfies PageMeta

export const Default = story({args: {Mark: fixtures.Alerting, defaultValue: DEFAULT_VALUE}})

export const Configured = story<ButtonMarkProps>({
	args: {Mark: fixtures.Button, options: [...], value: CONFIGURED_VALUE},
	parameters: {plainValue: fixtures.plainValue},
})
```

`story<T>()` carries the mark-props type a single file-level `Meta` cannot express, so one
page can mix mark shapes. Two details are load-bearing, both found by making a wrong story
compile:

- `NoInfer` on the parameter. Without it TS infers `TMarkProps` from `args.Mark`, so a story
  that declares no mark props silently accepts any component.
- The vue seam narrows `Mark`. Vue's published `MarkedInputProps` types it as a bare
  `Component`, so the generic would only reach `options[].mark` and a wrong component would
  typecheck.

Per-framework differences (panel position, event prop names) come from the fixtures, never
from a branch inside the story file.

### Fixtures

React fixtures are JSX. Vue fixtures declare components with `template:` strings rather than
`h()`, so the two files read alike:

```tsx
Testid: ({value}: MarkProps) => <mark data-testid="mark">{value}</mark>,          // react
```
```ts
Testid: defineComponent({props: {value: String}, template: '<mark data-testid="mark">{{ value }}</mark>'}),
```

This is the supported path: `@storybook/vue3-vite` registers a `storybook:vue-template-compilation`
plugin that aliases `vue` to `vue/dist/vue.esm-bundler.js`. The vue vitest project sets the same
alias explicitly — without it the specs work only because `@vue/test-utils` happens to pull the
compiler in.

The trade is real: a template string is not typechecked, so a typo inside it fails at runtime.
Vue SFCs were measured as the alternative and rejected — `vue-tsc` with `strictTemplates` refuses
`data-*` attributes on native elements (neither as an attribute nor through `v-bind`), which two
of the eight marks need, and one component per file turns one fixtures module into nine.

### CSF indexer rules

The indexer is a static parser. Four rules, each proven by a build:

1. **The default export must be an object literal** (optionally `as` / `satisfies`). A call
   (`defineMeta({...})`) or a member (`page.meta`) throws `NoMetaError` and exits 1. This is
   why the seam only *checks* meta and cannot own it.
2. **A story value may be any expression** — `story({...})` indexes fine.
3. **Never call the helper through a property.** `page.story({...})` and `x.extend({...})` are
   the CSF-factory idiom and throw `MixedFactoryError`.
4. **Never `export const {A, B} = ...`** — an object pattern is skipped, zero stories, silently.

Two silent traps behind those rules:

- **Story-level `name` / `tags` / `parameters.__id` are read only when written literally in the
  story file.** Supplied from a helper, a property access or a spread, they are ignored with a
  green build. No page uses them today; the first one written into a shared module will be lost.
- **A story file exports stories and nothing else.** Every named export is indexed, so an
  exported constant becomes a phantom story.

`story()` therefore refuses `name`, `tags` and `play`: TypeScript would accept them (they are
on `StoryObj`) and `composeStories` would honour them at runtime, but the index would not —
the sidebar and the tests would disagree with nothing to catch it. A story that needs one is
written as a plain object literal.

## Configuration changes

1. `vite.config.ts` — `resolve.extensions` per project; `include` gains
   `src/pages/**/*.spec.ts` in both; the react project also needs
   `exclude: ['**/node_modules/**', 'packages/storybook/src/pages/**/*.vue.spec.ts']`,
   otherwise `*.spec.ts` swallows the Vue specs.
2. `packages/storybook/tsconfig.react.json` — `moduleSuffixes: ['.react', '']`, and the stale
   `.storybook/preview.ts` exclude removed so the preview is finally typechecked.
3. `packages/storybook/tsconfig.vue.json` — `moduleSuffixes: ['.vue', '']`, plus
   `src/pages/**/*.spec.ts` and `.storybook/**/*.vue.ts` in `include`. The `**` globs do not
   reach dot-directories, which is why the preview was invisible to both compilers before.
4. `.storybook/main.ts` — `experimental_indexers` widening the CSF test to
   `/(?<!\.d)\.(story|stories)(\.(react|vue))?\.(m?[jt]sx?)$/`, `viteFinal` adding
   `resolve.extensions`, and one glob per instance:
   `['**/*.stories.react.tsx', '**/*.stories.ts']` and `['**/*.stories.vue.ts', '**/*.stories.ts']`.
5. `stories.react.spec.tsx` / `stories.vue.spec.ts` — the same two-entry `import.meta.glob`.
6. `.storybook/preview.ts` — one line, `export {default} from './annotations'`, which resolves
   per instance. The annotations live in `annotations.base.ts` + `annotations.react.ts` +
   `annotations.vue.ts`, and the vitest setup files import the framework one directly instead
   of re-listing decorators.
7. `oxlint.config.ts` — the spec/story override list gains `**/*.stories.vue.ts`,
   `**/*.fixtures.react.tsx`, `**/*.fixtures.vue.ts`.

### File naming

Every story file is either framework-free (`Base.stories.ts`) or carries the framework segment
LAST (`Drag.stories.react.tsx`). The old order (`Drag.react.stories.tsx`) cannot work: the
resolution scheme appends extensions, and `*.stories.ts` would also match `*.vue.stories.ts`.
That collision fails loudly in Storybook (duplicate ids) and SILENTLY in vite's
`import.meta.glob`, where an extglob exclusion matches nothing and a whole page drops out of
the snapshot sweep with only an "obsolete snapshots" note.

## Constraints discovered while prototyping

- **The Storybook indexer matches on the file name.** Its default test requires
  `.stories.<ext>` at the end, so `Base.stories.react.tsx` is not indexed without the
  widened `experimental_indexers` test. Symptom: `Invariant failed: No matching indexer
  found`.
- **Storybook does not see the vitest resolution.** Without `viteFinal` the preview build
  fails with `UNRESOLVED_IMPORT: Could not resolve './Base.fixtures'`.
- **`no-non-null-assertion` and `no-unsafe-type-assertion` are errors outside spec files.**
  `src/shared/lib` code must use the `dom.ts` helpers (`findEditingHost`) rather than
  `container.firstElementChild as HTMLElement`.
- **oxlint does not honour `moduleSuffixes`.** An import through the extension seam makes every
  downstream type `error`, which trips `no-unsafe-argument` / `no-unsafe-member-access` /
  `no-unsafe-return`. Spec, story and fixtures files are immune only because
  `oxlint.config.ts` disables those rules for them. Elsewhere — inside `shared/lib` — import
  the exact sibling (`./stories.react`), not the seam name.
- **Snapshots.** One shared spec file runs in two projects and would write to one `.snap`.
  No shared spec may use `toMatchInlineSnapshot`, and a shared spec that needs file
  snapshots requires a per-project `resolveSnapshotPath`. Not needed yet: the snapshot
  suites (`stories.*.spec`, `htmlSnapshot.react.spec`) stay per framework because they are
  built on framework-specific `import.meta.glob` patterns.

## Known gaps

- **Mount args are checked, `Mark` in vue is not.** `mount`/`mountEcho`/`mountComponent`/
  `mountApi` take `Partial<PageArgs>`, so a wrong arg key fails both compilers. Vue's
  `PageArgs` deliberately does NOT narrow `Mark`: a mark may declare no props and read its
  value through `useMark()`, and `Component<T>` rejects such a component against a concrete
  `T`. The narrowing stays in the `Story` type, where every mark comes from the page fixtures.
- **The seam exports one `component`.** Pages whose meta points elsewhere — `Api` uses a local
  `Playground` harness, and `Ant` / `Material` / `Rsuite` are the same category — cannot use
  `PageMeta` / `component` as they stand. They are react-only today, so nothing breaks; a
  framework-free story file for them needs the seam to take the component as a parameter.
- **Partial migration can double-index a page.** The globs match `*.stories.ts` AND
  `*.stories.<fw>.<ext>` unconditionally, so a page that gains `Foo.stories.ts` while keeping
  `Foo.stories.vue.ts` is indexed twice in the vue instance and the build fails on duplicate
  ids. Delete the old file in the same commit.
- **The browser suite is intermittently flaky.** Roughly one full `pnpm test` in five dies with
  `Failed to import test file .../vitest.setup.<fw>.ts — SyntaxError`, taking every file in that
  project with it. Observed on plain `b0` before any of this work, so it is pre-existing;
  a re-run is green. Worth its own investigation, not a blocker here.
- **`slotProps.container` handler names are unchecked** in both designs: the adapters type the
  bag as `Record<string, unknown>`, so `onKeyDwn` compiles. React logs a dev error at runtime;
  Vue binds a dead listener and says nothing.

## Verification protocol

Each page migration must prove it changed no behavior:

1. Before: `vitest run --project react --project vue --reporter=json` over the page,
   store test names and statuses.
2. After: the same run; the multiset of `fullName + status` must be identical. A shared test
   appears twice (once per project), a framework-only test once.
3. Story snapshots pass without `-u`.
4. `tsc -p tsconfig.react.json` and `vue-tsc -p tsconfig.vue.json` are clean.
5. `pnpm -F @markput/storybook run build` builds both instances and indexes the page's
   stories in `dist-*/index.json`.
6. `pnpm run lint:check`, `pnpm run format:check`.

Renaming a story file breaks every spec importing it: repoint those imports to the
extension-resolved form (`./Base.stories`) in the same commit.

## Migration scope and order

`Base` is done. Remaining pages, smallest first so the fixtures catalog grows gradually:

1. `Selection` (21/25 lines)
2. `Base/MarkputApi` (24/18)
3. `Base/keyboard` (188/186)
4. `Overlay` (215/245)
5. `renderCount` (303/300)
6. `Nested` (380/543)
7. `Slots` (415/556)
8. `Clipboard` (783/756)
9. `Drag` (892/884)

Then a drift-reconciliation pass: each of the ten differences found on `b0` becomes either a
shared test or an explicitly framework-only one with a stated reason.

Story files migrate with their page. React-only pages (`Ant`, `Api`, `Material`, `Rsuite`)
keep one framework and need no shared args module.

Out of scope: `stories.*.spec`, `htmlSnapshot.react.spec`, and `renderCount` semantics; the
`withPlainValue` decorator; the `onFocus`/`onFocusin` API divergence itself (the migration
records it, it does not fix it).

## Results on `Base`

| | baseline `b0` | after |
| --- | --- | --- |
| react + vue tests | 451 (445 passed, 6 todo) | 453 — the two extra are one new regression test running in both projects |
| story snapshots | — | unchanged |
| files defining the page's stories | 4 (`args` + two shims + none) | 1 |
| files for the whole page | 6 | 4 (+1 vue-only spec) |

`pnpm test`, `pnpm run typecheck`, `pnpm run lint:check`, `pnpm run format:check`,
`pnpm run build`, and both Storybook builds pass. Both instances index the page's four
entries from the single `Base.stories.ts`.

Two real bugs surfaced along the way, both from making something typecheck that never had:

- `MarkputApi` used a native `#private` field, which Vue's `defineExpose` Proxy cannot reach —
  `insertMark`, `replaceRange`, `select` and `caret` all threw through a Vue ref. Fixed in core.
- `withPlainValue.vue` annotated its story parameter as `VNode`, which is narrower than the
  decorator contract. Invisible until the preview entered a tsconfig program.

## Rejected: CSF factories

Prototyped in parallel on `Base`. Tests passed (451, identical), both Storybook instances
built, but the branch never type-checked: 11 errors under `tsconfig.react.json`, 8 under
`tsconfig.vue.json`. The blockers are structural, not cosmetic:

- `preview.meta({component: MarkedInput})` collapses the generic mark-props parameter to
  `unknown`, and `preview.type<T>()` **intersects** rather than replaces, producing
  `ComponentType<MarkProps> & ComponentType<unknown>` — unsatisfiable. React would have to
  adopt the `asStoryComponent` cast that only Vue needed so far.
- CSF permits one meta per file (`MultipleMetaError`). `Base` has stories with two different
  mark-props shapes, which CSF3 types per story via `StoryObj<MarkedInputProps<ButtonProps>>`;
  factories cannot express that.
- `composeStories(factoryModule)` is type-incompatible (`Store_CSFExports` requires a
  `default` export), so migrating one page's stories forces migrating every spec that
  imports them — six files here — in the same commit. Page-by-page migration is impossible.
- `VueStory` has no `Component` (only `ReactStory` does), so a Vue stateful harness must
  re-compose the story from `story.input` / `story.meta.input`; the first attempt produced
  `Rendered more hooks than during the previous render`.
- `definePreview` requires `addons`; omitting it degrades the renderer generic to `never`.
- CSF3-typed decorators are not assignable to the factory preview, so `withPlainValue` needs
  retyping in both frameworks.
- `Story.test()` is unavailable in Storybook 10.5.5 — `experimentalTestSyntax` is absent
  from `StorybookFeatures`.

The one measurable advantage: `story.run({canvasElement})` works on both renderers, so
`mount` becomes framework-free (33 lines instead of 64 + 73). That saving is smaller than
the three preview files it costs, and the echo harness stays per framework regardless.

Revisit when CSF factories leave experimental status and can type a generic component.

### Retried, wrapped in our own seam

The second attempt hid every known edge behind `shared/lib/stories.*`. It builds, indexes,
tests and typechecks — and still loses, because of a blocker the first attempt had not reached:
**the wrapper cannot own the meta.** The indexer only accepts a factory meta written literally
as `preview.meta({...})` with `preview` imported from a path matching
`/\/preview(\.(js|jsx|mjs|ts|tsx))?$/`; anything else is `BadMetaError`. So `preview`, `meta`
and the factory idiom leak into exactly the file the wrapper was meant to protect.

What it costs over CSF3, measured: two `as` casts and two lint suppressions where CSF3 needs
zero, `previewAnnotations` entries that must be absolute paths or fail at bundle time, and an
unresolved `componentPath` in `index.json`. Type safety comes out identical — the same errors
at the same positions — and only after adding `NoInfer`, which CSF3 needs anyway.

Three wins that surfaced during that spike were kept, because none of them needs factories: the
preview split, the vitest setups pointing at it, and typed `mount` args.
