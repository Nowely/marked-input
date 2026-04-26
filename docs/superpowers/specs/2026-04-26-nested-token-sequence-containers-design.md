# Nested Token Sequence Containers

Date: 2026-04-26

## Status

Proposed amendment to `docs/superpowers/specs/2026-04-26-structural-token-rendering-api-design.md`.

This spec keeps the structural renderer direction from the earlier design, but changes the nested mark contract. The previous contract assumed nested token roots could be discovered as direct element children of the custom mark root. That is too strict for real custom marks with controls, icons, labels, or layout wrappers.

## Problem

Structural rendering currently has a simple but fragile invariant:

- a mark root is the user-rendered Mark component root;
- if the mark has `token.children`, those child token roots must appear as direct non-control children of the mark root;
- `DomFeature` compares those DOM children against `token.children`.

The Todo story breaks this contract:

```tsx
<div className="todo">
	<input type="checkbox" />
	{children}
</div>
```

The parser produces the expected mark token and text child:

```txt
[mark "- [ ] Design Phase\n"]
  [text "Design Phase"]
```

React renders the text child through Markput-owned `Token(text)`, but the mark root now has two direct element children: the checkbox and the text span. `DomFeature` expects one child token element and sees two candidates, so it treats the subtree as ambiguous. The text token span is never reconciled with `token.content`, leaving an empty visible label.

The root cause is not parsing. The renderer owns the nested `children` prop, but core does not have an explicit DOM boundary that says "this is the nested token sequence for this mark".

## Goals

- Make nested token discovery independent from arbitrary custom mark DOM.
- Allow mark components to render controls, icons, labels, and layout wrappers around `{children}`.
- Keep text tokens core-managed: `DomFeature` still writes text content and `contentEditable`.
- Keep Mark roots rendered directly as user components.
- Avoid requiring users to register every control inside every custom Mark component.
- Keep DOM indexing deterministic and fail closed on ambiguous structures.
- Preserve block layout behavior and block control registration.
- Support React and Vue with the same conceptual renderer contract.

## Non-Goals

- Do not support marks that drop `{children}` when their markup has `__slot__` content.
- Do not support rendering the same `{children}` sequence multiple times.
- Do not make arbitrary custom Mark descendants editable token surfaces.
- Do not make user-authored `data-*` attributes part of the public contract.
- Do not reintroduce per-token wrapper elements around every Mark or Text token.
- Do not solve every selection behavior for form controls inside marks; controls remain non-token DOM and may need focused handling later.

## Design Summary

Every token list should have a Markput-owned sequence container.

There are two token-list levels:

- the root token sequence, owned by the editor container in inline layout or by block rows in block layout;
- nested token sequences, owned by each mark that has `token.children`.

React and Vue should stop passing raw mapped child tokens directly as mark children. Instead, when a mark token has children, the adapter passes an internal nested sequence host as `children`:

```tsx
<Component {...props}>
	<TokenChildren ownerPath={path}>
		{token.children.map(child => <Token key={key.get(child)} token={child} />)}
	</TokenChildren>
</Component>
```

The custom mark still writes natural JSX:

```tsx
const TodoItemMark = ({children}: MarkProps) => (
	<div className="todo">
		<input type="checkbox" />
		{children}
	</div>
)
```

The rendered DOM has an explicit nested token sequence boundary:

```html
<div class="todo" tabindex="0">
	<input type="checkbox">
	<span data-internal-markput-children-for="1">
		<span contenteditable="true">Design Phase</span>
	</span>
</div>
```

The exact marker shape is implementation detail. Prefer private ref registration over production behavior that depends on public attribute queries.

## Rendering Contract

For every mark token with `token.children.length > 0`, the adapter supplies exactly one nested sequence host through the framework `children` slot.

The user Mark component is responsible for rendering `{children}` exactly once.

Valid examples:

```tsx
<mark>{children}</mark>
```

```tsx
<label>
	<input type="checkbox" />
	<span className="label">{children}</span>
</label>
```

```tsx
<span>
	<Icon />
	<strong>{children}</strong>
	<button type="button">x</button>
</span>
```

Invalid examples:

```tsx
<mark />
```

```tsx
<mark>
	{children}
	{children}
</mark>
```

The nested sequence host must be transparent to users as much as possible. It is not a styling API. It exists so core can map `token.children` to the DOM without guessing around custom markup.

## React Adapter Shape

`Token.tsx` keeps rendering the resolved Mark component directly, but changes the shape of nested children.

Conceptual implementation:

```tsx
function TokenChildren({
	ownerPath,
	children,
}: {
	ownerPath: TokenPath
	children: ReactNode
}) {
	const dom = useMarkput(s => s.dom)
	const ref = useMemo(() => dom.childrenFor(ownerPath), [dom, ownerPath])
	return <span ref={ref}>{children}</span>
}
```

Then `Token` renders:

```tsx
const children =
	token.type === 'mark' && token.children.length > 0
		? (
				<TokenChildren ownerPath={path}>
					{token.children.map(child => <Token key={key.get(child)} token={child} />)}
				</TokenChildren>
			)
		: undefined

return (
	<TokenContext value={{store, token, address}}>
		{children ? <Component {...props}>{children}</Component> : <Component {...props} />}
	</TokenContext>
)
```

The actual implementation should keep types precise and avoid leaking `TokenChildren` from the public package API.

## Vue Adapter Shape

`Token.vue` follows the same contract. For a mark token with children, the default slot passed to the user component returns one internal `TokenChildren` host containing mapped child tokens.

Conceptual implementation:

```ts
const children =
	token.type === 'mark' && token.children.length > 0
		? () =>
				h(TokenChildren, {ownerPath: path}, () =>
					token.children.map(child => h(markRaw(Token), {key: key.get(child), token: child}))
				)
		: undefined
```

`TokenChildren` registers its root element with `store.dom.childrenFor(ownerPath)`.

## Core DOM API

Add a narrow internal DOM registration primitive:

```ts
childrenFor(ownerPath: TokenPath): DomRef
```

This is similar in shape to `controlFor`, but it has different semantics:

- `controlFor(path)` marks non-token DOM that should be ignored when locating editor content;
- `childrenFor(path)` identifies the nested token sequence host for the mark at `path`.

`childrenFor` is adapter-facing and internal to framework packages. It is not a public user API.

`DomFeature` should store registered child sequence hosts by owner path:

```ts
type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}
```

If multiple live registrations exist for the same owner path in a single render, the subtree is ambiguous and should not be indexed.

## Indexing Algorithm

On render, `DomFeature` still indexes top-level tokens from the root container or block rows.

For a mark token:

1. Register the mark root as the token element.
2. If the mark has no children, stop.
3. Look for a registered nested sequence host for the mark path.
4. If exactly one host exists and it is contained by the mark root, index `token.children` from that host's direct token element children.
5. If no host exists, fall back to the previous direct-child structural indexing for compatibility.
6. If more than one host exists, or the host is outside the mark root, emit a diagnostic and skip that child subtree.

The child sequence host itself is not a token. It is the local container for child token roots, analogous to how the editor container is the local container for top-level token roots.

## Styling And DOM Shape

The nested sequence host should be visually neutral.

Preferred starting point:

```css
display: contents;
```

This keeps mark layout close to the user's markup and avoids introducing extra inline boxes around slot content.

However, `display: contents` can have browser-specific selection and accessibility edge cases. If tests show unreliable text selection, caret placement, or accessibility tree behavior, use a neutral inline element instead:

```css
display: inline;
```

Block-like custom marks can still control layout outside the host:

```tsx
<div className="todo">
	<input type="checkbox" />
	<span className="todoText">{children}</span>
</div>
```

The sequence host is internal and should not be used for user-facing styling.

## Diagnostics

Add diagnostics for nested sequence contract violations:

- mark with children did not render the nested sequence host;
- multiple nested sequence hosts registered for one owner path;
- nested sequence host registered for a path that no longer resolves;
- nested sequence host is not contained by its owner mark root;
- nested sequence host child count does not match `token.children.length`;
- nested sequence host contains ambiguous non-token element children.

Diagnostics should include the owner token path when available. Invalid nested subtrees should be skipped rather than guessed.

## Behavior In Todo Story

Before:

```html
<div class="todo">
	<input type="checkbox">
	<span></span>
</div>
```

`DomFeature` sees two mark-root child elements and cannot know which one corresponds to the single text child token.

After:

```html
<div class="todo">
	<input type="checkbox">
	<span data-internal-sequence-host>
		<span contenteditable="true">Design Phase</span>
	</span>
</div>
```

`DomFeature` indexes `token.children` from the registered sequence host. The checkbox no longer participates in token child matching.

## Testing Plan

Add focused browser tests in both React and Vue.

React:

- render a mark with markup `'- [__value__] __slot__\n'`;
- custom Mark renders `<input />{children}`;
- assert the slot text is visible;
- assert the text span is contenteditable in editable mode;
- assert toggling the checkbox does not change token text indexing;
- assert raw value panel still contains the original todo markup.

Vue:

- equivalent custom Mark with an input before `slots.default?.()`;
- assert visible slot text and editable text span.

Core unit tests:

- `DomFeature` indexes child tokens from a registered child sequence host;
- direct-child indexing fallback still works when no child sequence host is registered;
- multiple child sequence hosts for one owner path emit an ambiguous diagnostic;
- a host outside the owner mark root is rejected.

Regression coverage:

- Todo story renders labels such as `Design Phase`, `Create wireframes`, and `Deploy to production`;
- nested markdown stories still render nested child tokens;
- plain text drag stories still render rows and content.

## Documentation Updates

When implementation lands, update:

- `packages/website/src/content/docs/development/architecture.md` to describe nested token sequence hosts;
- `packages/website/src/content/docs/guides/nested-marks.md` to state that Mark components with slot markup must render `{children}` exactly once;
- generated API docs only if public types change.

No public API documentation is needed if `childrenFor` and `TokenChildren` stay internal.

## Migration Notes

Existing custom marks that render `{children}` once should continue to work.

Existing custom marks that do not render `{children}` for slot markups will still fail, but the failure becomes clearer through diagnostics.

Marks that intentionally render children more than once are unsupported because one token path cannot map to two editable DOM subtrees.

User controls inside marks no longer need explicit control registration just to keep nested text visible. Control registration may still be needed later if selection, clipboard, or keyboard behavior inside those controls needs special handling.

## Open Questions

- Should the nested sequence host use `display: contents` by default, or should the adapters start with an inline `span` for safer browser behavior?
- Should `childrenFor` be exposed to framework adapters only by convention, or placed in a clearly internal namespace?
- Should missing nested sequence hosts be a hard diagnostic immediately, or should the fallback direct-child indexing remain for one release cycle?
- Should custom Span components also get a sequence/container model later, or remain root editable surfaces only?
