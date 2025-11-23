---
editUrl: false
next: false
prev: false
title: "OverlayHandler"
---

Defined in: [markput/src/utils/hooks/useOverlay.tsx:8](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useOverlay.tsx#L8)

## Properties

### close()

> **close**: () => `void`

Defined in: [markput/src/utils/hooks/useOverlay.tsx:19](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useOverlay.tsx#L19)

Used for close overlay.

#### Returns

`void`

***

### match

> **match**: `OverlayMatch`\<[`Option`](/api/interfaces/option/)\<[`MarkProps`](/api/interfaces/markprops/), [`OverlayProps`](/api/interfaces/overlayprops/)\>\>

Defined in: [markput/src/utils/hooks/useOverlay.tsx:27](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useOverlay.tsx#L27)

Overlay match details

***

### ref

> **ref**: `RefObject`\<`HTMLElement`\>

Defined in: [markput/src/utils/hooks/useOverlay.tsx:28](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useOverlay.tsx#L28)

***

### select()

> **select**: (`value`) => `void`

Defined in: [markput/src/utils/hooks/useOverlay.tsx:23](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useOverlay.tsx#L23)

Used for insert an annotation instead a triggered value.

#### Parameters

##### value

###### meta?

`string`

###### value

`string`

#### Returns

`void`

***

### style

> **style**: `object`

Defined in: [markput/src/utils/hooks/useOverlay.tsx:12](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useOverlay.tsx#L12)

Style with caret absolute position. Used for placing an overlay.

#### left

> **left**: `number`

#### top

> **top**: `number`
