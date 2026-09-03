---
editUrl: false
next: false
prev: false
title: "Store"
---

Defined in: [core/src/store/Store.ts:24](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L24)

ONE editor: every feature's state hangs off a field here, and the field name is how core, both
adapters and a consumer's own selector all address it.

THE NAME STAYS, and that is a decision rather than an omission. It carried
`//TODO rename to Markput, Core, Engine, Editor?` from before either adapter published it; all
TODO Extract MarkputContext with core 0 primitives that used controllers?
four name the PRODUCT or the PACKAGE rather than this object's role, `MarkputHandle` already
carries the product name for the thing a consumer holds, and this is `useMarkput`'s selector
parameter — so a rename lands in the first line of every consumer that reaches the imperative
surface, against no defect and no better name.

## Properties

### clipboard

```ts
readonly clipboard: ClipboardController;
```

Defined in: [core/src/store/Store.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L47)

***

### edit

```ts
readonly edit: EditController;
```

Defined in: [core/src/store/Store.ts:32](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L32)

***

### handle

```ts
readonly handle: MarkputHandle;
```

Defined in: [core/src/store/Store.ts:49](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L49)

***

### history

```ts
readonly history: HistoryModel;
```

Defined in: [core/src/store/Store.ts:34](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L34)

***

### host

```ts
readonly host: Host;
```

Defined in: [core/src/store/Store.ts:25](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L25)

***

### keyboard

```ts
readonly keyboard: KeyboardController;
```

Defined in: [core/src/store/Store.ts:45](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L45)

***

### overlay

```ts
readonly overlay: OverlayController;
```

Defined in: [core/src/store/Store.ts:36](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L36)

***

### props

```ts
readonly props: PropsModel;
```

Defined in: [core/src/store/Store.ts:26](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L26)

***

### rows

```ts
readonly rows: RowController;
```

Defined in: [core/src/store/Store.ts:40](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L40)

***

### slots

```ts
readonly slots: SlotsFeature;
```

Defined in: [core/src/store/Store.ts:30](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L30)

***

### tokens

```ts
readonly tokens: TokenModel;
```

Defined in: [core/src/store/Store.ts:28](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L28)
