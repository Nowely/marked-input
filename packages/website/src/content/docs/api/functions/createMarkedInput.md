---
editUrl: false
next: false
prev: false
title: "createMarkedInput"
---

```ts
function createMarkedInput<TMarkProps, TOverlayProps>(configs): ConfiguredMarkedInput<TMarkProps, TOverlayProps>;
```

Defined in: [markput/src/utils/functions/createMarkedInput.ts:13](https://github.com/Nowely/marked-input/blob/aae09b7351f8965355f759c8665c77d5cadbc14f/packages/markput/src/utils/functions/createMarkedInput.ts#L13)

Create the configured MarkedInput component.

## Type Parameters

| Type Parameter | Default type | Description |
| ------ | ------ | ------ |
| `TMarkProps` | [`MarkProps`](/api/interfaces/markprops/) | Type of props for the Mark component (default: MarkProps) |
| `TOverlayProps` | [`OverlayProps`](/api/interfaces/overlayprops/) | Type of props for the Overlay component (default: OverlayProps) |

## Parameters

| Parameter | Type |
| ------ | ------ |
| `configs` | `Omit`\<[`MarkedInputProps`](/api/interfaces/markedinputprops/)\<`TMarkProps`, `TOverlayProps`\>, `"value"` \| `"onChange"`\> |

## Returns

[`ConfiguredMarkedInput`](/api/type-aliases/configuredmarkedinput/)\<`TMarkProps`, `TOverlayProps`\>
