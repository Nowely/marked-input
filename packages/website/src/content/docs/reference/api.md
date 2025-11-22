---
title: API Reference
description: API documentation for Marked Input
---

## MarkedInput

| Name          | Type                         | Default       | Description                                    |
| ------------- | ---------------------------- | ------------- | ---------------------------------------------- |
| value         | string                       | `undefined`   | Annotated text with markups for mark           |
| defaultValue  | string                       | `undefined`   | Default value                                  |
| onChange      | (value: string) => void      | `undefined`   | Change event                                   |
| Mark          | ComponentType<T = MarkProps> | `undefined`   | Component that used for render markups         |
| Overlay       | ComponentType                | `Suggestions` | Component that is rendered by trigger          |
| readOnly      | boolean                      | `undefined`   | Prevents from changing the value               |
| options       | OptionProps[]                | `[{}]`        | Passed options for configure                   |
| showOverlayOn | OverlayTrigger               | `change`      | Triggering events for overlay                  |
| slots         | Slots                        | `undefined`   | Override internal components (container, span) |
| slotProps     | SlotProps                    | `undefined`   | Props to pass to slot components               |

## Helpers

| Name              | Type                                                                                | Description                                  |
| ----------------- | ----------------------------------------------------------------------------------- | -------------------------------------------- |
| createMarkedInput | <T = MarkToken>(configs: MarkedInputProps<T>): ConfiguredMarkedInput<T>             | Create the configured MarkedInput component. |
| annotate          | (markup: Markup, params: {value: string, meta?: string}) => string                  | Make annotation from the markup              |
| denote            | (value: string, callback: (mark: MarkToken) => string, markups: Markup[]) => string | Transform the annotated text                 |
| useMark           | () => MarkHandler                                                                   | Allow to use dynamic mark                    |
| useOverlay        | () => OverlayHandler                                                                | Use overlay props                            |
| useListener       | (type, listener, deps) => void                                                      | Event listener                               |

## Types

```typescript
type OverlayTrigger = Array<'change' | 'selectionChange'> | 'change' | 'selectionChange' | 'none'
```

```typescript
interface MarkToken {
    type: 'mark'
    content: string
    position: {start: number; end: number}
    descriptor: MarkupDescriptor
    value: string
    meta?: string
    nested?: {
        content: string
        start: number
        end: number
    }
    children: Token[] // Nested tokens (empty array if no nesting)
}

interface TextToken {
    type: 'text'
    content: string
    position: {start: number; end: number}
}

interface MarkProps {
    value?: string
    meta?: string
    nested?: string // Raw nested content as string
    children?: ReactNode // Rendered nested content
}

type Token = TextToken | MarkToken
```

```typescript
interface OverlayHandler {
    /**
     * Style with caret absolute position. Used for placing an overlay.
     */
    style: {
        left: number
        top: number
    }
    /**
     * Used for close overlay.
     */
    close: () => void
    /**
     * Used for insert an annotation instead a triggered value.
     */
    select: (value: {value: string; meta?: string}) => void
    /**
     * Overlay match details
     */
    match: OverlayMatch
    ref: RefObject<HTMLElement>
}
```

```typescript
interface MarkHandler<T> {
    /**
     * MarkToken ref. Used for focusing and key handling operations.
     */
    ref: RefObject<T>
    /**
     * Change mark.
     * @options.silent doesn't change itself value and meta, only pass change event.
     */
    change: (props: {value: string; meta?: string}, options?: {silent: boolean}) => void
    /**
     * Remove itself.
     */
    remove: () => void
    /**
     * Passed the readOnly prop value
     */
    readOnly?: boolean
    /**
     * Nesting depth of this mark (0 for root-level marks)
     */
    depth: number
    /**
     * Whether this mark has nested children
     */
    hasChildren: boolean
    /**
     * Parent mark token (undefined for root-level marks)
     */
    parent?: MarkToken
    /**
     * Array of child tokens (read-only)
     */
    children: Token[]
}
```

```typescript
type OverlayMatch = {
    /**
     * Found value via a overlayMatch
     */
    value: string
    /**
     * Triggered value
     */
    source: string
    /**
     * Piece of text, in which was a overlayMatch
     */
    span: string
    /**
     * Html element, in which was a overlayMatch
     */
    node: Node
    /**
     * Start position of a overlayMatch
     */
    index: number
    /**
     * OverlayMatch's option
     */
    option: Option
}
```

```typescript jsx
export interface MarkProps {
    value?: string
    meta?: string
    nested?: string
    children?: ReactNode
}

export interface OverlayProps {
    trigger?: string
    data?: string[]
}

export interface Option<TMarkProps = MarkProps, TOverlayProps = OverlayProps> {
    /**
     * Template string instead of which the mark is rendered.
     * Must contain placeholders: `__value__`, `__meta__`, and/or `__nested__`
     *
     * Placeholder types:
     * - `__value__` - main content (plain text, no nesting)
     * - `__meta__` - additional metadata (plain text, no nesting)
     * - `__nested__` - content supporting nested structures
     *
     * @default "@[__value__](__meta__)"
     */
    markup?: Markup
    /**
     * Per-option slot components (mark and overlay).
     * If not specified, falls back to global Mark/Overlay components.
     *
     * Component Resolution Priority (for each slot):
     * 1. option.slots[slot] (per-option component)
     * 2. MarkedInputProps[slot] (global component)
     * 3. Default component (Suggestions for overlay, undefined for mark)
     *
     * This allows fine-grained control with global fallbacks.
     */
    slots?: {
        mark?: ComponentType<TMarkProps>
        overlay?: ComponentType<TOverlayProps>
    }
    /**
     * Props for slot components.
     */
    slotProps?: {
        /**
         * Props for the mark component. Can be either:
         * - A static object that completely replaces MarkProps
         * - A function that transforms MarkProps into component-specific props
         *
         * @example
         * // Static object
         * mark: { label: 'Click me', primary: true }
         *
         * @example
         * // Function
         * mark: ({ value, meta }) => ({ label: value, onClick: () => alert(meta) })
         */
        mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
        /**
         * Props for the overlay component. Passed directly to the Overlay component.
         *
         * @example
         * overlay: {
         *   trigger: '@',
         *   data: ['Alice', 'Bob']
         * }
         */
        overlay?: TOverlayProps
    }
}
```

