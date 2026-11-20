# The published declarations inline csstype

Status: needs-info

`dist/index.d.ts` of `@markput/react` and `@markput/vue` carries its own copy of csstype. Core's
`CSSProperties` is `CSS.Properties<string | number>` from csstype (`core/src/shared/types.ts:248`),
core is bundled into each adapter, and csstype is in neither adapter's dependencies — only in
core's `devDependencies` — so the declaration bundler inlines it.

Before rolldown-plugin-dts 0.28, csstype was 470 KB of the 612 KB React file. Since 0.28 (3c1acf94)
it is kept whole in a non-exported namespace, and the files are 1033 KB (React) and 1030 KB (Vue,
from 609 KB). Every consumer's type-check parses all of it.

Needs a decision, because either answer changes what the packages publish:

- declare csstype as a dependency of both adapters and keep it external, so the declarations import
  it; consumers already install it, through `@types/react` and `@vue/runtime-dom`;
- or give core a `CSSProperties` of its own that does not reach into csstype.

Whichever is chosen, compare the declaration files before and after, and type-check both with
`skipLibCheck` off, as 3c1acf94 did.

## Comments

**November deps update.** The inlined copy is not just size: it is a second csstype that drifts
from the consumer's. csstype 3.2.4 widened `Property.FlexWrap` (adds `"balance"` and
`string & {}`). With core on 3.2.4 and `@types/react` still resolving 3.2.3, the docs samples that
pass a slot's `style` to a React element failed with TS2322; pinned back to 3.2.3, `vue-tsc` failed
the other way, at `packages/vue/markput/src/components/MarkedInput.vue:74`, where
`@vue/runtime-dom` 3.5.46 brings 3.2.4. In the workspace the fix is one csstype; a consumer cannot
dedupe against the inlined copy, so a consumer whose framework types resolve a different csstype
gets the same TS2322 in one direction or the other. The update ships 3.2.4 inlined, the version a
fresh install resolves today. Keeping csstype external (the first option above) removes the drift.
