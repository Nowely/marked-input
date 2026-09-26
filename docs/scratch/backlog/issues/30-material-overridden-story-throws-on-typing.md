# The Material "Overridden" story throws on every keystroke

Status: ready-for-agent

Typing into Material → Overridden leaves the text unchanged and raises
`TypeError: Cannot read properties of undefined (reading 'value')`. A browser probe measured it on
2026-09-25 under MUI 7 and again under MUI 9, with the same result, so it predates the MUI 9
upgrade.

The story passes `MarkedInput` to MUI's `Input` as its `inputComponent` and reads the change as an
event (`Material.stories.react.tsx:69`):

```tsx
onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
```

`MarkedInput` calls `onChange` with the new value, a string (`MarkedInput.tsx:73`), and MUI's
`InputBase` hands whatever its input component passed straight to the `onChange` it was given
(`handleChange(event, ...args)` → `onChange(event, ...args)`). So `e` is a string, `e.target` is
`undefined`, and the handler throws before `setValue` runs.

Nothing caught it because nothing types into the story: the story sweep's HTML snapshot is its
only coverage.

## Scope

Take the string in the story's handler, with a comment saying why a handler MUI types for an event
receives a string. Add a browser spec that types into the story.

Rsuite → Overridden also plugs `MarkedInput` into a library `Input` (through `as`, reading
`onChange`'s second argument) and was not checked. Cover it in the same spec.

## Verification

The new spec fails on the current story and passes after the fix: the typed text reaches the value
and no error is raised. `pnpm test` green.
