---
editUrl: false
next: false
prev: false
title: "SlotProps"
---

Defined in: [react/markput/src/types.ts:131](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L131)

Props merged onto the components the editor paints itself. EXTENDS the core contract, so a key
core learns to read is a key this type declares.

Not the same key set as [Slots](/api/interfaces/slots/), and the names say why: `slots.paragraph` is consulted only
for a row with NO kind, while `slotProps.row` reaches every row.

## Extends

- `CoreSlotProps`

## Properties

### container?

```ts
optional container: Record<string, unknown> & object & DataAttributes;
```

Defined in: [react/markput/src/types.ts:132](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L132)

#### Type Declaration

##### className?

```ts
optional className: string;
```

##### style?

```ts
optional style: CSSProperties;
```

#### Overrides

```ts
CoreSlotProps.container
```

***

### row?

```ts
optional row: Record<string, unknown> & object & DataAttributes;
```

Defined in: [react/markput/src/types.ts:134](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L134)

Merged onto EVERY row's wrapper — kind or paragraph alike, unlike `slots.paragraph`.

#### Type Declaration

##### className?

```ts
optional className: string;
```

##### style?

```ts
optional style: CSSProperties;
```

#### Overrides

```ts
CoreSlotProps.row
```
