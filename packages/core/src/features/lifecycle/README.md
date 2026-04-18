# Lifecycle (handled by Store)

The Store does not use a dedicated `Lifecycle` class. Feature enable/disable is driven directly by Store in its constructor:

```ts
watch(this.event.mounted, () => Object.values(this.features).forEach(f => f.enable()))
watch(this.event.unmounted, () => Object.values(this.features).forEach(f => f.disable()))
```

Framework adapters emit:

- `store.event.mounted()` on initial mount (enables features)
- `store.event.unmounted()` on unmount (disables features and disposes subscriptions)

Reactive re-parse on prop changes is handled inside `ParseFeature` by watching a computed over `props.value` and `computed.parser`; there is no separate "updated" event.
