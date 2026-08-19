---
editUrl: false
next: false
prev: false
title: "MarkputApi"
---

Defined in: [core/src/store/MarkputApi.ts:18](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L18)

What a consumer holds through the `ref` prop: React's `useImperativeHandle` target
(`react/.../MarkedInput.tsx`) and Vue's `defineExpose` argument (`vue/.../MarkedInput.vue`).

TWO MEMBERS, deliberately. The v2 surface added twelve more — `value`, `nodes`, `find`,
`changed`, `insertMark`, `replaceText`, `replaceRange`, `setValue`, `tx`, `selection`,
`select`, `caret` — and they are withdrawn: the editor is driven by its props, so a write
belongs in the `value` a parent already owns, not in a second imperative path that has to
agree with it. What is left is what props cannot express: the host element, and moving the
caret into it.

It owns nothing. Both members lower onto a state owner — the host for the element, the token
layer for the caret — so the shape of the handle can move without moving state.

## Constructors

### Constructor

```ts
new MarkputApi(host, tokens): MarkputApi;
```

Defined in: [core/src/store/MarkputApi.ts:19](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `host` | `Host` |
| `tokens` | `TokenModel` |

#### Returns

`MarkputApi`

## Accessors

### container

#### Get Signature

```ts
get container(): HTMLElement | null;
```

Defined in: [core/src/store/MarkputApi.ts:24](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L24)

##### Returns

`HTMLElement` \| `null`

## Methods

### focus()

```ts
focus(): void;
```

Defined in: [core/src/store/MarkputApi.ts:28](https://github.com/Nowely/marked-input/blob/next/packages/core/src/store/MarkputApi.ts#L28)

#### Returns

`void`
