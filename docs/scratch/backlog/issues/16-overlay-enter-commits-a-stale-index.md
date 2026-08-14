# Overlay Enter commits a stale index

Status: ready-for-human

`navigateSuggestions` treats "has an active row" as "the index is not NaN", which is an
existence test, not a range test — `suggestionNavigation.ts:13,21`. So
`navigateSuggestions(KEYBOARD.ENTER, 5, 2)` answers `{action: 'select', index: 5}`. UP and
DOWN hide it because their modulo wraps; ENTER is the only branch that does not clamp.

Both adapters then index the filtered list with it and never reset the active row when the
list shrinks. `active` is written only from the navigation result — React
`Suggestions.tsx:13,32`, Vue `Suggestions.vue:18,39` — so narrowing the query while a high
row is active makes `filtered[result.index]` `undefined` and commits
`select({value: undefined, meta: '5'})`.

The unit spec added in `overlay/suggestionNavigation.spec.ts` deliberately leaves this
unpinned: a mutation clamping ENTER to `Math.min(activeIndex, length - 1)` survives the whole
suite today.

Needs a person because the fix is a choice, not a task: clamp in `navigateSuggestions` (one
place, changes a core answer both adapters already consume) or reset `active` in each adapter
when `match`/`filtered` changes (two places, keeps core's answer literal). Pin whichever with
the surviving mutation above.
