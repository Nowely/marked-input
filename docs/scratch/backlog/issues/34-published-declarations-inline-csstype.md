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
