# Can the host be hidden inside the token model?

Type: research
Status: open

`TokenModel` does not own the host. `Store` constructs it (`store/Store.ts:13`) and injects it;
`TokenModel` reads it to set editable state, as a pipeline dependency, and as a `DomModel`
dependency.

The container is reachable from outside `DomModel` in eight production places: `Store.host`
itself, `MarkputApi.container`, `OverlayController`, `KeyboardController` (which passes it down
into `input.ts` / `blockEdit.ts` / `beforeInput.ts`), `ClipboardController`, `SelectionDriver`,
and both adapters — React `Container.tsx` writes it and `Suggestions.tsx` reads it, Vue the
same. `DomModel` already receives the container only as a closure, so the encapsulation gap is
*above* `DomModel`, not inside it.

**Question.** Can `Host`'s container become `TokenModel`-owned state, with features taking
`tokens.onMounted`, without breaking `MarkputApi.container` and the two adapters that read
`store.host.container` directly? And is the cheap half — moving `rendered`, which has one
reader — worth doing on its own?

Answering this needs a position on whether `MarkputApi.container` stays published.
