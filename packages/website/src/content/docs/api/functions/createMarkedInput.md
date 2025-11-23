---
editUrl: false
next: false
prev: false
title: "createMarkedInput"
---

> **createMarkedInput**\<`TMarkProps`, `TOverlayProps`\>(`configs`): [`ConfiguredMarkedInput`](/api/type-aliases/configuredmarkedinput/)\<`TMarkProps`, `TOverlayProps`\>

Defined in: [markput/src/utils/functions/createMarkedInput.ts:13](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/functions/createMarkedInput.ts#L13)

Create the configured MarkedInput component.

## Type Parameters

### TMarkProps

`TMarkProps` = [`MarkProps`](/api/interfaces/markprops/)

Type of props for the Mark component (default: MarkProps)

### TOverlayProps

`TOverlayProps` = [`OverlayProps`](/api/interfaces/overlayprops/)

Type of props for the Overlay component (default: OverlayProps)

## Parameters

### configs

`Omit`\<[`MarkedInputProps`](/api/interfaces/markedinputprops/)\<`TMarkProps`, `TOverlayProps`\>, `"value"` \| `"onChange"`\>

## Returns

[`ConfiguredMarkedInput`](/api/type-aliases/configuredmarkedinput/)\<`TMarkProps`, `TOverlayProps`\>
