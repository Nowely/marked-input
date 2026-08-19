// ═══ Public API v2 (spec §2.3) ════════════════════════════════════════════════
export {MarkputHandle} from './src/store/MarkputHandle'
// The ONLY resolution path for both adapters, which import it as a value and construct it.
export {Store} from './src/store'
// Each one is NAMEABILITY for a signature a consumer meets, which is the only test this list
// applies: `Anchors` because `OverlayMatch.range` is one (S2.5); `TreeNode`/`TextNode`/`MarkNode`
// because both adapters render them and `useMark()` hands one back; `MarkPatch` because it is
// `MarkNode.update`'s parameter, and without the export a consumer cannot declare a patch
// separately (inference covers a literal at the call site and nothing else).
//
// `Id` was here too and is NOT any more: it is `type Id = number`, so the export bought a name
// for something already nameable, and the one signature that made the name worth having —
// `find(id)` on the public handle — is gone. `TreeNode.id` keeps its type and now prints as
// `number`.
export type {Anchors, MarkNode, MarkPatch, NodeAnchor, TextNode, TreeNode} from './src/features/tokens'

// String-domain utilities (spec §2.3: keep)
export {annotate, denote} from './src/features/tokens'
// `MarkToken` is here because `denote`'s callback parameter IS one: without the export the
// type is not nameable outside the package, so a consumer cannot declare the callback
// separately (inference and `Parameters<typeof denote>[1]` cover everything else). S2.8
// dropped it with `Token`/`TextToken` and that was a public-API weakening the spec did not
// intend; S2.9 restores this one only — see the note at the bottom of this file.
export type {MarkToken, Markup} from './src/features/tokens'

// Adapter utilities (spec §2.3: keep)
export {cx} from './src/shared/utils'
export {key} from './src/shared/classes'
export {filterSuggestions, navigateSuggestions} from './src/features/overlay'
export {getAlwaysShowHandle} from './src/features/block'
export type {
	OverlayMatch,
	OverlayTrigger,
	CoreOption,
	CSSProperties,
	CoreSlots,
	DataAttributes,
	DraggableConfig,
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
// `Token` is referenced only by `parser/`, `tree/tree.ts`, `tree/adopt.ts`,
// `tree/adoptUtils.ts` and the test-only oracle, none of which is exported; `TextToken`
// only by `adopt.ts` and that oracle.