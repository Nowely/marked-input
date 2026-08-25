// ═══ Public API v2 (spec §2.3) ════════════════════════════════════════════════
export {MarkputHandle} from './src/store/MarkputHandle'
// The ONLY resolution path for both adapters, which import it as a value and construct it.
export {Store} from './src/store'
// What a consumer MEETS: `Anchors` because `OverlayMatch.range` is one (S2.5);
// `TreeNode`/`TextNode`/`MarkNode` because both adapters render them and `useMark()` hands one
// back; `NodeAnchor` because `Anchors` is a pair of them.
//
// `Id` and `MarkPatch` were here and are not any more — the list is now what a consumer RECEIVES,
// not everything they might want to name. `Id` is `type Id = number`, so its export bought a name
// for something already nameable, and the signature that made the name worth having (`find(id)` on
// the public handle) is gone. `MarkPatch` is `MarkNode.update`'s parameter: inference covers a
// patch literal at the call site, `Parameters<MarkNode['update']>[0]` covers a declaration, and
// nothing in this repo or either adapter imported the name. Both are still declared inline in the
// built `.d.ts`, so no shape a consumer sees changed — only the ability to import the name.
export type {Anchors, MarkNode, NodeAnchor, RowNode, TextNode, TreeNode} from './src/features/tokens'
// `RowNode.moveTo`'s parameter: a consumer wiring its own drag has to build one, and the row it
// names is a `RowNode` — so the type is unbuildable without both names.
export type {RowPlacement} from './src/features/tokens'

// String-domain utilities (spec §2.3: keep)
export {annotate, denote} from './src/features/tokens'
// `MarkToken` is here because `denote`'s callback parameter IS one: without the export the
// type is not nameable outside the package, so a consumer cannot declare the callback
// separately (inference and `Parameters<typeof denote>[1]` cover everything else). S2.8
// dropped it with `Token`/`TextToken` and that was a public-API weakening the spec did not
// intend; S2.9 restores this one only — see the note at the bottom of this file.
export type {MarkToken, Markup} from './src/features/tokens'
// `RowConfig` is `TokenModel.rowConfig`'s type, and `store.tokens` is public: without the
// export the block parse policy a consumer can already read is not nameable.
export type {RowConfig} from './src/features/tokens'

// Adapter utilities (spec §2.3: keep)
export {cx} from './src/shared/utils/cx'
export {key} from './src/shared/classes'
// `suggestionLabel` rides with `filterSuggestions`: `overlay.data` rows may separate the label
// from the value they write, and both adapters' Suggestions render and key by the label.
export {filterSuggestions, navigateSuggestions, suggestionLabel} from './src/features/overlay'
// `BLOCK_MENU_ITEMS` is the block menu's content contract; both adapters' BlockControls maps it.
// `RowBox` is what `store.block.boxOf()` answers — the coordinates both layers paint at.
export {BLOCK_MENU_ITEMS, getAlwaysShowHandle} from './src/features/block'
export type {RowBox} from './src/features/block'
export type {
	OverlayMatch,
	OverlayTrigger,
	CoreOption,
	// `CoreOption.row`'s type: a consumer declaring a row kind separately needs the name.
	RowSpec,
	// `CoreOption.menu`'s type and what `overlay.entries` hands a menu component: a consumer
	// writing that component declares both.
	MenuSpec,
	MenuEntry,
	// `overlay.choose`'s parameter: both adapters re-declare it on `OverlayHandler`, so the
	// union is spelled once rather than three times.
	OverlayPick,
	CSSProperties,
	CoreSlots,
	DataAttributes,
	DraggableConfig,
	// `CoreOption.overlay.data`'s row type: a consumer building that list separately needs it.
	Suggestion,
	Slot,
	// NOT dead, and invisible to grep: both adapters carry
	// `declare module '@markput/core' { interface SlotRegistry {…} }` (react/vue
	// src/augment.ts). Drop the export and `Slot` collapses to `unknown`, which fails
	// every slot component as a JSX element (TS2604/TS2786, 8 errors). §2.3's table
	// lists it among the zero-importer drops; a module augmentation is not an import.
	SlotRegistry,
} from './src/shared/types'

// The `useMarkput` runtime. §2.3's "signal/computed/watch/batch not exported from root"
// row is WRONG for these five and for `watch`'s role as the `changed` subscription verb:
// `computed` + `watch` are react `useMarkput`'s runtime (useMarkput.ts:1), `effect` is
// vue's (:1), and `Computed`/`SignalValues` are in their signatures. The rest of the
// reactive system — signal, batch, event, isReactive, Signal, Event — has zero non-core
// importers and is gone.
export {computed, effect, watch} from './src/shared/signals'
export type {Computed, SignalValues} from './src/shared/signals'
export {readSelected} from './src/shared/readSelected'
export type {Selectable, ObjectSelector} from './src/shared/readSelected'
// `readSelected`'s sibling on the subscription side: the per-node repaint target all four
// adapter Token/Block components pass to `useMarkput`, hoisted so the field contract has one
// owner instead of a copy per adapter.
export {renderSubscription} from './src/features/tokens'

// Mark metadata (spec §2.3: keep — the whole implementation of useMarkInfo)
export {toMarkInfo} from './src/shared/editorContracts'
export type {MarkInfo} from './src/shared/editorContracts'

// ═══ What `Token` stopped being ══════════════════════════════════════════════
// `Token`/`TextToken`/`MarkToken` LEFT this file at S2.8 (spec D12). They were the render
// projection; both adapters now render `TreeNode` straight off `tokens.nodes()`, and the
// snapshot that materialized them is gone. `Token` survives INSIDE core as the parser's
// output type (`parser/Parser.ts#parse`) and as the §7.1 correctness oracle the tree specs
// assert through (`tree/__testing__/snapshot.ts`).
//
// S2.9 PUT `MarkToken` BACK, and only it: `denote` is a public export whose callback
// parameter is a `MarkToken`, so dropping the type made a shipped signature unnameable —
// a weakening D12 did not intend. `Token` and `TextToken` stay internal, and that was
// checked rather than assumed: neither appears in any signature reachable from this file.
// `Token` is referenced only by `parser/`, `tree/tree.ts`, `tree/adopt.ts` and the
// test-only oracle, none of which is exported; `TextToken` only by `adopt.ts` and
// that oracle.