---
editUrl: false
next: false
prev: false
title: "Store"
---

Defined in: [core/src/store/Store.ts:26](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L26)

ONE editor: every feature's state hangs off a field here, and the field name is how core, both
adapters and a consumer's own selector all address it.

THE NAME STAYS, and that is a decision rather than an omission. It carried
`//TODO rename to Markput, Core, Engine, Editor?` from before either adapter published it; all
four name the PRODUCT or the PACKAGE rather than this object's role, `MarkputHandle` already
carries the product name for the thing a consumer holds, and this is `useMarkput`'s selector
parameter — so a rename lands in the first line of every consumer that reaches the imperative
surface, against no defect and no better name.

## Properties

### clipboard

```ts
readonly clipboard: ClipboardController;
```

Defined in: [core/src/store/Store.ts:49](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L49)

***

### edit

```ts
readonly edit: EditController;
```

Defined in: [core/src/store/Store.ts:34](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L34)

***

### handle

```ts
readonly handle: MarkputHandle;
```

Defined in: [core/src/store/Store.ts:51](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L51)

***

### history

```ts
readonly history: HistoryModel;
```

Defined in: [core/src/store/Store.ts:36](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L36)

***

### host

```ts
readonly host: Host;
```

Defined in: [core/src/store/Store.ts:27](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L27)

***

### keyboard

```ts
readonly keyboard: KeyboardController;
```

Defined in: [core/src/store/Store.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L47)

***

### overlay

```ts
readonly overlay: OverlayController;
```

Defined in: [core/src/store/Store.ts:38](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L38)

***

### props

```ts
readonly props: PropsModel;
```

Defined in: [core/src/store/Store.ts:28](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L28)

***

### rows

```ts
readonly rows: RowController;
```

Defined in: [core/src/store/Store.ts:42](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L42)

***

### slots

```ts
readonly slots: SlotsFeature;
```

Defined in: [core/src/store/Store.ts:32](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L32)

***

### tokens

```ts
readonly tokens: TokenModel;
```

Defined in: [core/src/store/Store.ts:30](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L30)
