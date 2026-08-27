---
editUrl: false
next: false
prev: false
title: "Store"
---

Defined in: [core/src/store/Store.ts:23](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L23)

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

Defined in: [core/src/store/Store.ts:46](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L46)

***

### edit

```ts
readonly edit: EditController;
```

Defined in: [core/src/store/Store.ts:31](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L31)

***

### handle

```ts
readonly handle: MarkputHandle;
```

Defined in: [core/src/store/Store.ts:48](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L48)

***

### history

```ts
readonly history: HistoryModel;
```

Defined in: [core/src/store/Store.ts:33](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L33)

***

### host

```ts
readonly host: Host;
```

Defined in: [core/src/store/Store.ts:24](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L24)

***

### keyboard

```ts
readonly keyboard: KeyboardController;
```

Defined in: [core/src/store/Store.ts:44](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L44)

***

### overlay

```ts
readonly overlay: OverlayController;
```

Defined in: [core/src/store/Store.ts:35](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L35)

***

### props

```ts
readonly props: PropsModel;
```

Defined in: [core/src/store/Store.ts:25](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L25)

***

### rows

```ts
readonly rows: RowController;
```

Defined in: [core/src/store/Store.ts:39](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L39)

***

### slots

```ts
readonly slots: SlotsFeature;
```

Defined in: [core/src/store/Store.ts:29](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L29)

***

### tokens

```ts
readonly tokens: TokenModel;
```

Defined in: [core/src/store/Store.ts:27](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/Store.ts#L27)
