import type * as Markput from '@markput/react'
/**
 * The scope a docs PAGE establishes and its later fences lean on.
 *
 * A guide imports `MarkedInput` and `useState` once at the top and then shows fence after fence
 * that omits the import. Those fences declare themselves `fragment` or `markup`, and only they get
 * this file in their program — a fence with no directive is compiled alone, so an undeclared name
 * in a sample a reader is meant to paste whole is still an error.
 *
 * These are ambient declarations, not imports: a sample that DOES import a name shadows the global
 * with its own binding rather than colliding with it.
 */
import type * as ReactTypes from 'react'

declare global {
	// ── React, as a page's first fence imports it ──────────────────────────────
	const useState: typeof ReactTypes.useState
	const useEffect: typeof ReactTypes.useEffect
	const useLayoutEffect: typeof ReactTypes.useLayoutEffect
	const useMemo: typeof ReactTypes.useMemo
	const useCallback: typeof ReactTypes.useCallback
	const useRef: typeof ReactTypes.useRef
	const useContext: typeof ReactTypes.useContext
	const createContext: typeof ReactTypes.createContext
	const forwardRef: typeof ReactTypes.forwardRef
	const memo: typeof ReactTypes.memo
	type FC<P = {}> = ReactTypes.FC<P>
	type ReactNode = ReactTypes.ReactNode
	type ReactElement = ReactTypes.ReactElement
	type CSSProperties = ReactTypes.CSSProperties
	type PropsWithChildren<P = unknown> = ReactTypes.PropsWithChildren<P>
	type ComponentProps<T extends ReactTypes.ElementType> = ReactTypes.ComponentProps<T>
	type HTMLAttributes<T> = ReactTypes.HTMLAttributes<T>
	type RefObject<T> = ReactTypes.RefObject<T>
	type Ref<T> = ReactTypes.Ref<T>
	/** The namespace itself, for the event types whose bare names belong to the DOM. */
	export import React = ReactTypes

	// ── The published adapter surface ──────────────────────────────────────────
	const MarkedInput: typeof Markput.MarkedInput
	const OverlayList: typeof Markput.OverlayList
	const useMark: typeof Markput.useMark
	const useMarkInfo: typeof Markput.useMarkInfo
	const useMarkput: typeof Markput.useMarkput
	const useOverlay: typeof Markput.useOverlay
	const useControlRef: typeof Markput.useControlRef
	const Atomic: typeof Markput.Atomic
	const annotate: typeof Markput.annotate
	const denote: typeof Markput.denote
	const watch: typeof Markput.watch
	type MarkedInputProps = Markput.MarkedInputProps
	type Option<TMarkProps = Markput.MarkProps> = Markput.Option<TMarkProps>
	type MarkProps = Markput.MarkProps
	type RowProps = Markput.RowProps
	type RowSpec = Markput.RowSpec
	type OverlayProps = Markput.OverlayProps
	type OverlayHandler = Markput.OverlayHandler
	type OverlayPick = Markput.OverlayPick
	type Slots = Markput.Slots
	type SlotProps = Markput.SlotProps
	type MarkNode = Markput.MarkNode
	type RowNode = Markput.RowNode
	type TextNode = Markput.TextNode
	type TreeNode = Markput.TreeNode
	type NodeAnchor = Markput.NodeAnchor
	type MarkToken = Markput.MarkToken
	type Markup = Markput.Markup
	type MenuSpec = Markput.MenuSpec
	type OverlayRow = Markput.OverlayRow
	type RowPlacement = Markput.RowPlacement
	type Suggestion = Markput.Suggestion

	// ── The editor's own vocabulary, as the page around the fence named it ─────
	/** What `useMarkput(s => s)` hands back. */
	const store: Markput.Store
	const options: Markput.Option[]
	const value: string
	const meta: string
	const mark: Markput.MarkNode
	const marks: readonly Markput.MarkNode[]
	const row: Markput.RowNode
	const overlay: Markput.OverlayHandler
}

export {}